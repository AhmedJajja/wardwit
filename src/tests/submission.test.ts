import { describe, it, expect } from 'vitest';
import { finalizeSession } from '../domain/scoring';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { StudySession } from '../domain/types';

describe('Idempotent Session Submission', () => {
  it('finalizes an in-progress session with score and status', () => {
    const q1 = DEMO_QUESTIONS[0];
    const initialSession: StudySession = {
      id: 'sub-test-1',
      name: 'Submission Test',
      mode: 'timed',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 5,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {
        [q1.id]: {
          selectedOptionId: q1.correctOptionId,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 25,
        },
      },
    };

    const finalizedTime = 2000;
    const completedSession = finalizeSession(initialSession, finalizedTime);

    expect(completedSession.status).toBe('completed');
    expect(completedSession.completedAt).toBe(finalizedTime);
    expect(completedSession.score).toBeDefined();
    expect(completedSession.score?.correctCount).toBe(1);
    expect(completedSession.score?.percentage).toBe(100);

    // Call finalizeSession again with a different timestamp (simulating repeat submission)
    const repeatFinalized = finalizeSession(completedSession, 9999);
    expect(repeatFinalized.completedAt).toBe(finalizedTime); // Must remain 2000!
    expect(repeatFinalized.score).toEqual(completedSession.score);
  });

  it('uses firstSubmittedOptionId in tutor mode to prevent changing graded answers', () => {
    const q1 = DEMO_QUESTIONS[0]; // correctOptionId: 'A'
    const session: StudySession = {
      id: 'sub-test-2',
      name: 'Tutor First Attempt Test',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 5,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {
        [q1.id]: {
          firstSubmittedOptionId: 'B', // Student first submitted B (incorrect)
          selectedOptionId: 'A', // Later clicked A after seeing explanation
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 30,
        },
      },
    };

    const finalized = finalizeSession(session);
    // Score must reflect the FIRST submitted option 'B' (0% correct)
    expect(finalized.score?.correctCount).toBe(0);
    expect(finalized.score?.incorrectCount).toBe(1);
    expect(finalized.score?.percentage).toBe(0);
  });
});
