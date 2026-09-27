import { describe, it, expect } from 'vitest';
import { calculateComprehensiveStats } from '../domain/analytics';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { StudySession } from '../domain/types';

describe('Honest Progress Reporting and Analytics', () => {
  it('separates first-attempt accuracy from repeat-attempt accuracy', () => {
    const q1 = DEMO_QUESTIONS[0]; // correct: 'A'
    const q2 = DEMO_QUESTIONS[1]; // correct: 'B'

    // Session 1: Student answers q1 correctly ('A'), q2 incorrectly ('C')
    const session1: StudySession = {
      id: 'session-1',
      name: 'Block 1',
      mode: 'tutor',
      status: 'completed',
      createdAt: 1000,
      startedAt: 1000,
      completedAt: 1500,
      durationMinutes: 10,
      questionSnapshots: [q1, q2],
      currentIndex: 0,
      answers: {
        [q1.id]: { selectedOptionId: 'A', isFlagged: false, eliminatedOptionIds: [], timeSpentSeconds: 20 },
        [q2.id]: { selectedOptionId: 'C', isFlagged: false, eliminatedOptionIds: [], timeSpentSeconds: 30 },
      },
    };

    // Session 2: Student repeats q2 and gets it right ('B')
    const session2: StudySession = {
      id: 'session-2',
      name: 'Block 2 (Repeat)',
      mode: 'tutor',
      status: 'completed',
      createdAt: 2000,
      startedAt: 2000,
      completedAt: 2500,
      durationMinutes: 10,
      questionSnapshots: [q2],
      currentIndex: 0,
      answers: {
        [q2.id]: { selectedOptionId: 'B', isFlagged: false, eliminatedOptionIds: [], timeSpentSeconds: 15 },
      },
    };

    const stats = calculateComprehensiveStats([session1, session2]);

    expect(stats.totalAttempts).toBe(3);
    expect(stats.uniqueQuestionsAttempted).toBe(2);

    // First attempt accuracy: 1 correct (q1) out of 2 unique questions = 50%
    expect(stats.firstAttemptAccuracy.correct).toBe(1);
    expect(stats.firstAttemptAccuracy.denominator).toBe(2);
    expect(stats.firstAttemptAccuracy.percentage).toBe(50);

    // Repeat attempt accuracy: 1 repeat attempt (q2 in session2), which was correct = 100%
    expect(stats.repeatAttemptAccuracy.correct).toBe(1);
    expect(stats.repeatAttemptAccuracy.denominator).toBe(1);
    expect(stats.repeatAttemptAccuracy.percentage).toBe(100);
  });

  it('marks topics with < 3 attempts as insufficient data', () => {
    const q1 = DEMO_QUESTIONS[0];
    const session: StudySession = {
      id: 'session-single',
      name: 'Block',
      mode: 'tutor',
      status: 'completed',
      createdAt: 1000,
      startedAt: 1000,
      completedAt: 1200,
      durationMinutes: 5,
      questionSnapshots: [q1],
      currentIndex: 0,
      answers: {
        [q1.id]: { selectedOptionId: 'A', isFlagged: false, eliminatedOptionIds: [], timeSpentSeconds: 15 },
      },
    };

    const stats = calculateComprehensiveStats([session]);
    expect(stats.topicPerformance.length).toBe(1);
    expect(stats.topicPerformance[0].attemptsCount).toBe(1);
    expect(stats.topicPerformance[0].signal).toBe('insufficient_data');
    expect(stats.insufficientDataTopicsCount).toBe(1);
  });
});
