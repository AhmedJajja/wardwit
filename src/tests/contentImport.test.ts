import { describe, it, expect } from 'vitest';
import {
  validateQuestionForApproval,
  dryRunImportQuestions,
} from '../persistence/indexedDbRepo';
import { filterQuestionsForSession } from '../domain/eligibility';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { Question, SessionFilterCriteria } from '../domain/types';

describe('Content Workspace & Question Import Integrity', () => {
  it('validates required fields before allowing approved status', () => {
    const incompleteQuestion: Partial<Question> = {
      id: 'test-inc-1',
      vignette: 'Too short',
      options: [{ id: 'A', text: 'Option A' }], // Only 1 option!
      correctOptionId: 'B', // Not in options!
      explanation: '',
    };

    const val = validateQuestionForApproval(incompleteQuestion);
    expect(val.isValid).toBe(false);
    expect(val.errors.length).toBeGreaterThan(0);
    expect(val.errors.some((e) => e.includes('At least 2 answer options'))).toBe(true);
    expect(val.errors.some((e) => e.includes('must match one of the available options'))).toBe(true);
  });

  it('dry-run flags duplicate IDs and invalid rows without modifying data', () => {
    const rawJson = JSON.stringify([
      {
        id: 'dup-001',
        vignette: 'A valid scenario prompt for testing biostatistics interpretation.',
        options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }],
        correctOptionId: 'A',
        explanation: 'Detailed explanation text.',
        learningObjective: 'Understand basic biostats testing.',
        system: 'Demo - Biostatistics',
        discipline: 'Demo - Epidemiology',
        topic: 'Test Topic',
        editorialStatus: 'approved',
      },
      {
        // Duplicate ID in same file!
        id: 'dup-001',
        vignette: 'Another prompt with duplicate id.',
        options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }],
        correctOptionId: 'A',
        explanation: 'Detailed explanation text.',
        learningObjective: 'Objective.',
        system: 'Demo - Biostatistics',
        discipline: 'Demo - Epidemiology',
        topic: 'Test Topic 2',
        editorialStatus: 'approved',
      },
    ]);

    const result = dryRunImportQuestions(rawJson, []);
    expect(result.success).toBe(true);
    expect(result.summary?.duplicatesInFile).toContain('dup-001');
    expect(result.summary?.totalRows).toBe(2);
  });

  it('strictly excludes draft and archived questions from study session filters', () => {
    const testPool: Question[] = [
      ...DEMO_QUESTIONS.slice(0, 3), // Approved demo questions
      {
        ...DEMO_QUESTIONS[0],
        id: 'draft-item-99',
        editorialStatus: 'draft', // Must not leak!
      },
      {
        ...DEMO_QUESTIONS[1],
        id: 'archived-item-88',
        editorialStatus: 'archived', // Must not leak!
      },
    ];

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
      count: 20,
      mode: 'tutor',
    };

    const eligibility = filterQuestionsForSession(testPool, history, criteria);
    // Only the 3 approved questions should be eligible!
    expect(eligibility.eligibleQuestions.length).toBe(3);
    expect(eligibility.eligibleQuestions.some((q) => q.id === 'draft-item-99')).toBe(false);
    expect(eligibility.eligibleQuestions.some((q) => q.id === 'archived-item-88')).toBe(false);
  });
});
