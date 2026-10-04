/**
 * Scoring and Performance Logic for WardWit
 */

import type { StudySession, SessionScore, ConfidenceStats } from './types';

export function calculateSessionScore(session: StudySession): SessionScore {
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let totalTimeSeconds = 0;

  const breakdown: Record<'confident' | 'unsure' | 'guessed' | 'unrated', ConfidenceStats> = {
    confident: { total: 0, correct: 0 },
    unsure: { total: 0, correct: 0 },
    guessed: { total: 0, correct: 0 },
    unrated: { total: 0, correct: 0 },
  };

  const questions = session.questionSnapshots;
  const answers = session.answers;

  for (const q of questions) {
    const ans = answers[q.id];
    // In tutor mode, the locked first submitted answer is used if available;
    // otherwise selectedOptionId.
    const chosenOptionId = ans?.firstSubmittedOptionId ?? ans?.selectedOptionId ?? null;
    const timeSpent = ans?.timeSpentSeconds || 0;
    totalTimeSeconds += timeSpent;

    const isAnswered = chosenOptionId !== null && chosenOptionId !== undefined;
    const isCorrect = isAnswered && chosenOptionId === q.correctOptionId;

    if (!isAnswered) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    // Confidence breakdown
    const rawConf = ans?.confidence as any;
    const confLevel: 'confident' | 'unsure' | 'guessed' | 'unrated' =
      rawConf && breakdown[rawConf as keyof typeof breakdown] ? rawConf : 'unrated';
    if (isAnswered) {
      breakdown[confLevel].total += 1;
      if (isCorrect) {
        breakdown[confLevel].correct += 1;
      }
    }
  }

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    correctCount,
    incorrectCount,
    unansweredCount,
    percentage,
    totalTimeSeconds,
    confidenceBreakdown: breakdown,
  };
}

/**
 * Idempotently finalizes a study session.
 * Does not duplicate attempts if already completed.
 */
export function finalizeSession(session: StudySession, completedAt = Date.now()): StudySession {
  if (session.status === 'completed' && session.score) {
    return session; // Already finalized, keep original score and completion time
  }

  const score = calculateSessionScore(session);
  return {
    ...session,
    status: 'completed',
    completedAt: session.completedAt || completedAt,
    score,
  };
}
