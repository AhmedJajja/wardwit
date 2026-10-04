import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  sessionRepo,
  dailyActivityRepo,
  reviewQueueRepo,
  clearAllLocalData,
} from '../persistence/indexedDbRepo';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { StudySession } from '../domain/types';

describe('Authoritative Finalization and Late Autosave Protection', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  const q1 = DEMO_QUESTIONS[0];
  const q2 = DEMO_QUESTIONS[1];
  const todayStr = '2026-09-27';

  it('commits session status, activity credit, and review changes together atomically', async () => {
    const session: StudySession = {
      id: 'session-atomic-1',
      name: 'Atomic Finalization Test',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [q1, q2],
      currentIndex: 0,
      answers: {
        [q1.id]: {
          selectedOptionId: q1.correctOptionId,
          firstSubmittedOptionId: q1.correctOptionId,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 30,
          confidence: 'confident',
        },
        [q2.id]: {
          selectedOptionId: 'WRONG',
          firstSubmittedOptionId: 'WRONG',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 40,
        },
      },
    };

    // Save initial in-progress session
    await sessionRepo.save(session);

    // Finalize via single atomic transaction
    const result = await sessionRepo.finalizeSessionTransaction(session, todayStr, 2000);
    expect(result.success).toBe(true);
    expect(result.alreadyCompleted).toBe(false);
    expect(result.session.status).toBe('completed');
    expect(result.session.score?.correctCount).toBe(1);
    expect(result.session.score?.incorrectCount).toBe(1);

    // Verify daily activity recorded exactly once
    const act = await dailyActivityRepo.getActivityForDate(todayStr);
    expect(act).not.toBeNull();
    expect(act?.questionsAnswered).toBe(2);
    expect(act?.correctCount).toBe(1);
    expect(act?.sessionsCompleted).toBe(1);

    // Verify review queue has item for incorrect question q2
    const queue = await reviewQueueRepo.getAll();
    expect(queue.length).toBe(1);
    expect(queue[0].questionId).toBe(q2.id);
    expect(queue[0].reason).toBe('incorrect');
  });

  it('prevents stale / duplicate completion from doubling activity or review queue entries', async () => {
    const session: StudySession = {
      id: 'session-idempotent-2',
      name: 'Duplicate Completion Test',
      mode: 'timed',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {
        [q1.id]: {
          selectedOptionId: 'INCORRECT_OPT',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 20,
        },
      },
    };

    await sessionRepo.save(session);

    // First completion
    const res1 = await sessionRepo.finalizeSessionTransaction(session, todayStr, 2000);
    expect(res1.alreadyCompleted).toBe(false);

    // Activity after 1st completion
    const act1 = await dailyActivityRepo.getActivityForDate(todayStr);
    expect(act1?.sessionsCompleted).toBe(1);
    expect(act1?.questionsAnswered).toBe(1);

    const queue1 = await reviewQueueRepo.getAll();
    expect(queue1.length).toBe(1);

    // Second completion with a stale in-progress session object
    const res2 = await sessionRepo.finalizeSessionTransaction(session, todayStr, 3000);
    expect(res2.alreadyCompleted).toBe(true);
    expect(res2.session.status).toBe('completed');

    // Activity must NOT have doubled
    const act2 = await dailyActivityRepo.getActivityForDate(todayStr);
    expect(act2?.sessionsCompleted).toBe(1); // Still 1!
    expect(act2?.questionsAnswered).toBe(1); // Still 1!

    // Queue must NOT have duplicate entries
    const queue2 = await reviewQueueRepo.getAll();
    expect(queue2.length).toBe(1); // Still 1!
  });

  it('protects completed sessions against late autosaves and does not reopen them', async () => {
    const session: StudySession = {
      id: 'session-late-autosave',
      name: 'Late Autosave Protection',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {},
    };

    await sessionRepo.save(session);

    // Session is completed
    const finResult = await sessionRepo.finalizeSessionTransaction(session, todayStr, 2000);
    expect(finResult.session.status).toBe('completed');

    // A late autosave debounce arrives from a component that still held status: 'in-progress'
    const lateStaleAutosave: StudySession = {
      ...session,
      status: 'in-progress', // Stale!
      currentIndex: 1,
    };

    // Save must ignore / abort overwriting the completed session
    await sessionRepo.save(lateStaleAutosave);

    // Persisted session must remain completed
    const stored = await sessionRepo.getById(session.id);
    expect(stored?.status).toBe('completed');
    expect(stored?.completedAt).toBe(2000);
  });
});
