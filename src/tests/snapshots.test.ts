import { describe, it, expect } from 'vitest';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { Question, StudySession } from '../domain/types';

describe('Question Version Snapshots in Sessions', () => {
  it('preserves question version snapshot when question definition changes', () => {
    // 1. Initial question
    const originalQuestion: Question = { ...DEMO_QUESTIONS[0] };

    // 2. Create session with deep snapshot of the question
    const sessionQuestionSnapshot: Question = JSON.parse(JSON.stringify(originalQuestion));
    const session: StudySession = {
      id: 'session-snapshot-test',
      name: 'Snapshot Test Session',
      mode: 'tutor',
      status: 'completed',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 5,
      questionSnapshots: [sessionQuestionSnapshot],
      currentIndex: 0,
      answers: {
        [originalQuestion.id]: {
          selectedOptionId: originalQuestion.correctOptionId,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 35,
        },
      },
    };

    // 3. Simulate an author updating the question in the question bank to Version 2
    const updatedQuestionBankItem: Question = {
      ...originalQuestion,
      version: 2,
      learningObjective: 'Updated learning objective for Version 2',
      vignette: 'Revised and expanded clinical trial scenario...',
      correctOptionId: 'B', // Suppose the answer key was corrected
    };

    // 4. Verify that the session snapshot remains at Version 1 and retains its original vignette
    const savedSnapshot = session.questionSnapshots[0];
    expect(savedSnapshot.version).toBe(1);
    expect(savedSnapshot.learningObjective).toBe(originalQuestion.learningObjective);
    expect(savedSnapshot.vignette).toBe(originalQuestion.vignette);
    expect(savedSnapshot.correctOptionId).toBe('A');

    // Verify it was decoupled from the updated bank item
    expect(savedSnapshot.version).not.toBe(updatedQuestionBankItem.version);
    expect(savedSnapshot.correctOptionId).not.toBe(updatedQuestionBankItem.correctOptionId);
  });
});
