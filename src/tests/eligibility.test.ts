import { describe, it, expect } from 'vitest';
import { filterQuestionsForSession, buildQuestionHistory } from '../domain/eligibility';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { StudySession, SessionFilterCriteria } from '../domain/types';

describe('Session Eligibility and Filters', () => {
  it('returns exact matching count without duplicating questions', () => {
    const history = {
      answeredQuestionIds: new Set<string>(),
      incorrectQuestionIds: new Set<string>(),
      flaggedQuestionIds: new Set<string>(),
    };

    const criteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'all',
      count: 5,
      mode: 'tutor',
    };

    const result = filterQuestionsForSession(DEMO_QUESTIONS, history, criteria);
    expect(result.eligibleQuestions.length).toBe(5);
    expect(result.actualCount).toBe(5);
    expect(result.totalMatchingFilters).toBe(DEMO_QUESTIONS.length);
    expect(result.hasInsufficientQuestions).toBe(false);
  });

  it('handles insufficient questions honestly without silent duplication', () => {
    const history = {
      answeredQuestionIds: new Set<string>(),
      incorrectQuestionIds: new Set<string>(),
      flaggedQuestionIds: new Set<string>(),
    };

    // Filter by a specific system that only has 1 or 2 demo questions
    const criteria: SessionFilterCriteria = {
      systems: ['Demo - Cardiovascular Logic'],
      disciplines: [],
      topics: [],
      pool: 'all',
      count: 10, // Requesting 10 when fewer exist
      mode: 'timed',
    };

    const result = filterQuestionsForSession(DEMO_QUESTIONS, history, criteria);
    expect(result.actualCount).toBeLessThan(10);
    expect(result.hasInsufficientQuestions).toBe(true);
    expect(result.message).toContain('Only');
    // Ensure all returned items are unique
    const ids = result.eligibleQuestions.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('filters correctly for unused, incorrect, and flagged pools', () => {
    // Mock past session
    const mockSession: StudySession = {
      id: 'session-1',
      name: 'Past Session',
      mode: 'tutor',
      status: 'completed',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [DEMO_QUESTIONS[0], DEMO_QUESTIONS[1], DEMO_QUESTIONS[2]],
      currentIndex: 0,
      answers: {
        'demo-001': {
          selectedOptionId: DEMO_QUESTIONS[0].correctOptionId, // Correct
          isFlagged: true,
          eliminatedOptionIds: [],
          timeSpentSeconds: 30,
        },
        'demo-002': {
          selectedOptionId: 'E', // Incorrect (correct is B)
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 45,
        },
      },
    };

    const history = buildQuestionHistory([mockSession]);

    // Test Flagged pool
    const flaggedCriteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'flagged',
      count: 10,
      mode: 'tutor',
    };
    const flaggedResult = filterQuestionsForSession(DEMO_QUESTIONS, history, flaggedCriteria);
    expect(flaggedResult.eligibleQuestions.map((q) => q.id)).toEqual(['demo-001']);

    // Test Incorrect pool
    const incorrectCriteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'incorrect',
      count: 10,
      mode: 'tutor',
    };
    const incorrectResult = filterQuestionsForSession(DEMO_QUESTIONS, history, incorrectCriteria);
    expect(incorrectResult.eligibleQuestions.map((q) => q.id)).toEqual(['demo-002']);

    // Test Unused pool
    const unusedCriteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'unused',
      count: 20,
      mode: 'tutor',
    };
    const unusedResult = filterQuestionsForSession(DEMO_QUESTIONS, history, unusedCriteria);
    expect(unusedResult.eligibleQuestions.some((q) => q.id === 'demo-001')).toBe(false);
    expect(unusedResult.eligibleQuestions.some((q) => q.id === 'demo-002')).toBe(false);
  });

  it('strictly excludes draft and archived questions from study sessions', () => {
    const history = {
      answeredQuestionIds: new Set<string>(),
      incorrectQuestionIds: new Set<string>(),
      flaggedQuestionIds: new Set<string>(),
    };

    const mixedBank = [
      { ...DEMO_QUESTIONS[0], id: 'q-approved', editorialStatus: 'approved' as const },
      { ...DEMO_QUESTIONS[1], id: 'q-draft', editorialStatus: 'draft' as const },
      { ...DEMO_QUESTIONS[2], id: 'q-archived', editorialStatus: 'archived' as const },
      { ...DEMO_QUESTIONS[3], id: 'q-in-review', editorialStatus: 'in_review' as const },
    ];

    const criteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'all',
      count: 10,
      mode: 'tutor',
    };

    const result = filterQuestionsForSession(mixedBank, history, criteria);
    expect(result.eligibleQuestions.map((q) => q.id)).toEqual(['q-approved']);
    expect(result.eligibleQuestions.some((q) => q.id === 'q-draft')).toBe(false);
    expect(result.eligibleQuestions.some((q) => q.id === 'q-archived')).toBe(false);
    expect(result.eligibleQuestions.some((q) => q.id === 'q-in-review')).toBe(false);
  });

  it('prevents cross-contamination between educational and demo content', () => {
    const history = {
      answeredQuestionIds: new Set<string>(),
      incorrectQuestionIds: new Set<string>(),
      flaggedQuestionIds: new Set<string>(),
    };

    const mixedBank = [
      { ...DEMO_QUESTIONS[0], id: 'q-demo-1', contentKind: 'demo' as const, editorialStatus: 'approved' as const },
      { ...DEMO_QUESTIONS[1], id: 'q-demo-2', contentKind: 'demo' as const, editorialStatus: 'approved' as const },
      { ...DEMO_QUESTIONS[2], id: 'q-edu-1', contentKind: 'educational' as const, editorialStatus: 'approved' as const },
    ];

    // Request educational content only
    const eduCriteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'all',
      count: 10,
      mode: 'tutor',
      contentKind: 'educational',
    };

    const eduResult = filterQuestionsForSession(mixedBank, history, eduCriteria);
    expect(eduResult.eligibleQuestions.map((q) => q.id)).toEqual(['q-edu-1']);

    // Request demo content only
    const demoCriteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'all',
      count: 10,
      mode: 'tutor',
      contentKind: 'demo',
    };

    const demoResult = filterQuestionsForSession(mixedBank, history, demoCriteria);
    expect(demoResult.eligibleQuestions.map((q) => q.id)).toEqual(['q-demo-1', 'q-demo-2']);
  });
});
