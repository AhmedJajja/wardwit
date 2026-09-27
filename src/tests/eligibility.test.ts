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
});
