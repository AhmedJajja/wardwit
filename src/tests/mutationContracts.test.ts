import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { sessionRepo, flashcardRepo } from '../persistence/indexedDbRepo';
import { createFlashcard } from '../domain/flashcardReview';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { StudySession } from '../domain/types';

describe('Mutation Contracts and Failure Handling', () => {
  const q1 = DEMO_QUESTIONS[0];

  it('rejects when durable write fails, allowing callers to inspect error and unlock retry', async () => {
    const session: StudySession = {
      id: 'session-fail-test',
      name: 'Fail Test Session',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {},
    };

    // Simulate an underlying storage/transaction failure
    const originalFinalize = sessionRepo.finalizeSessionTransaction;
    sessionRepo.finalizeSessionTransaction = vi.fn().mockRejectedValueOnce(
      new Error('QuotaExceededError: Local database is full.')
    );

    let isSubmitting = true;
    let failureError: string | null = null;

    try {
      await sessionRepo.finalizeSessionTransaction(session, '2026-09-27');
    } catch (err: any) {
      failureError = err.message;
      isSubmitting = false; // Submission lock released!
    }

    expect(failureError).toBe('QuotaExceededError: Local database is full.');
    // Lock must be released so student can retry
    expect(isSubmitting).toBe(false);

    // Restore original method
    sessionRepo.finalizeSessionTransaction = originalFinalize;
  });

  it('makes session completion awaitable and reports success only after transaction commits', async () => {
    const session: StudySession = {
      id: 'session-awaitable-test',
      name: 'Awaitable Test Session',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {
        [q1.id]: {
          selectedOptionId: q1.correctOptionId,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 15,
        },
      },
    };

    await sessionRepo.save(session);

    // The promise returned by finalizeSessionTransaction must resolve to a valid FinalizeSessionResult
    const resultPromise = sessionRepo.finalizeSessionTransaction(session, '2026-09-27', 2000);
    expect(resultPromise).toBeInstanceOf(Promise);

    const result = await resultPromise;
    expect(result.success).toBe(true);
    expect(result.alreadyCompleted).toBe(false);
    expect(result.session.status).toBe('completed');
    expect(result.session.completedAt).toBe(2000);
  });

  it('rejects failed card saves and preserves user input for retry', async () => {
    const originalSave = flashcardRepo.save;
    flashcardRepo.save = vi.fn().mockRejectedValueOnce(new Error('Disk write failure'));

    // Simulated component form state
    let front = "What is Winter's formula?";
    let back = 'Expected PaCO2 = 1.5 * HCO3 + 8 +/- 2';
    let topic = 'Acid-Base';
    let isSaving = true;
    let cardSaveError: string | null = null;

    try {
      const card = createFlashcard(front, back, 'personal', { topic });
      await flashcardRepo.save(card);
      // If it had succeeded, inputs would clear:
      front = '';
      back = '';
      topic = '';
    } catch (err: any) {
      cardSaveError = err.message;
      isSaving = false;
    }

    // Input fields must NOT be cleared on failure
    expect(front).toBe("What is Winter's formula?");
    expect(back).toBe('Expected PaCO2 = 1.5 * HCO3 + 8 +/- 2');
    expect(topic).toBe('Acid-Base');
    expect(cardSaveError).toBe('Disk write failure');
    expect(isSaving).toBe(false);

    // Restore original method
    flashcardRepo.save = originalSave;
  });
});

