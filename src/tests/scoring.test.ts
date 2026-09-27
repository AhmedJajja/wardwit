import { describe, it, expect } from 'vitest';
import { calculateSessionScore } from '../domain/scoring';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { StudySession } from '../domain/types';

describe('Scoring Logic', () => {
  it('correctly scores answered and unanswered questions', () => {
    const q1 = DEMO_QUESTIONS[0]; // correctOptionId: 'A'
    const q2 = DEMO_QUESTIONS[1]; // correctOptionId: 'B'
    const q3 = DEMO_QUESTIONS[2]; // correctOptionId: 'B'
    const q4 = DEMO_QUESTIONS[3]; // correctOptionId: 'A'

    const session: StudySession = {
      id: 'session-score-test',
      name: 'Score Test',
      mode: 'timed',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 10,
      questionSnapshots: [q1, q2, q3, q4],
      currentIndex: 0,
      answers: {
        [q1.id]: {
          selectedOptionId: 'A', // Correct
          confidence: 'confident',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 40,
        },
        [q2.id]: {
          selectedOptionId: 'C', // Incorrect
          confidence: 'unsure',
          isFlagged: true,
          eliminatedOptionIds: [],
          timeSpentSeconds: 50,
        },
        [q3.id]: {
          selectedOptionId: 'B', // Correct
          confidence: 'guessed',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 30,
        },
        // q4 is deliberately left UNANSWERED
      },
    };

    const score = calculateSessionScore(session);

    expect(score.totalQuestions).toBe(4);
    expect(score.correctCount).toBe(2);
    expect(score.incorrectCount).toBe(1);
    expect(score.unansweredCount).toBe(1);
    expect(score.percentage).toBe(50); // 2/4 = 50%
    expect(score.totalTimeSeconds).toBe(120);

    // Check confidence breakdown
    expect(score.confidenceBreakdown.confident.total).toBe(1);
    expect(score.confidenceBreakdown.confident.correct).toBe(1);

    expect(score.confidenceBreakdown.unsure.total).toBe(1);
    expect(score.confidenceBreakdown.unsure.correct).toBe(0);

    expect(score.confidenceBreakdown.guessed.total).toBe(1);
    expect(score.confidenceBreakdown.guessed.correct).toBe(1);

    expect(score.confidenceBreakdown.unrated.total).toBe(0);
  });

  it('handles empty questions list gracefully', () => {
    const emptySession: StudySession = {
      id: 'empty',
      name: 'Empty',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: 1000,
      startedAt: 1000,
      durationMinutes: 5,
      questionSnapshots: [],
      currentIndex: 0,
      answers: {},
    };

    const score = calculateSessionScore(emptySession);
    expect(score.totalQuestions).toBe(0);
    expect(score.percentage).toBe(0);
    expect(score.unansweredCount).toBe(0);
  });
});
