/**
 * Honest Progress Reporting and Performance Analytics for WardWit
 * 
 * DESIGN PRINCIPLE:
 * No invented "mastery percentage", predicted scores, pass probabilities, or national percentiles.
 * All signals strictly derive from recorded attempts and clearly show denominators.
 */

import type { StudySession, ComprehensiveProgressStats, TopicPerformanceStat, WeeklyActivitySummary } from './types';

export function calculateComprehensiveStats(sessions: StudySession[]): ComprehensiveProgressStats {
  const completedSessions = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.createdAt - b.createdAt);

  let totalAttempts = 0;
  const questionAttemptHistory = new Map<string, Array<{ isCorrect: boolean; timestamp: number }>>();
  const topicStatsMap = new Map<string, { system: string; attempts: number; correct: number }>();

  // Process all session answers
  for (const session of completedSessions) {
    for (const q of session.questionSnapshots) {
      const ans = session.answers[q.id];
      if (!ans) continue;

      const chosenOptionId = ans.firstSubmittedOptionId ?? ans.selectedOptionId;
      if (!chosenOptionId) continue; // Unanswered questions are not counted as attempts

      totalAttempts++;
      const isCorrect = chosenOptionId === q.correctOptionId;

      // Track by question ID
      if (!questionAttemptHistory.has(q.id)) {
        questionAttemptHistory.set(q.id, []);
      }
      questionAttemptHistory.get(q.id)!.push({
        isCorrect,
        timestamp: ans.submittedAt || session.createdAt,
      });

      // Track by Topic
      const topicKey = q.topic;
      if (!topicStatsMap.has(topicKey)) {
        topicStatsMap.set(topicKey, { system: q.system, attempts: 0, correct: 0 });
      }
      const tStat = topicStatsMap.get(topicKey)!;
      tStat.attempts++;
      if (isCorrect) tStat.correct++;
    }
  }

  const uniqueQuestionsAttempted = questionAttemptHistory.size;

  // 1. First-attempt vs Repeat-attempt accuracy
  let firstAttemptCorrect = 0;
  let firstAttemptDenominator = uniqueQuestionsAttempted;

  let repeatAttemptCorrect = 0;
  let repeatAttemptDenominator = 0;

  for (const attempts of questionAttemptHistory.values()) {
    if (attempts.length > 0) {
      // First attempt
      if (attempts[0].isCorrect) {
        firstAttemptCorrect++;
      }
      // Subsequent attempts (repeats)
      for (let i = 1; i < attempts.length; i++) {
        repeatAttemptDenominator++;
        if (attempts[i].isCorrect) {
          repeatAttemptCorrect++;
        }
      }
    }
  }

  const firstAttemptPercentage = firstAttemptDenominator > 0
    ? Math.round((firstAttemptCorrect / firstAttemptDenominator) * 100)
    : 0;

  const repeatAttemptPercentage = repeatAttemptDenominator > 0
    ? Math.round((repeatAttemptCorrect / repeatAttemptDenominator) * 100)
    : 0;

  // 2. Topic performance with visible, documented practice signal rules:
  // - If attempts < 3: 'insufficient_data'
  // - If percentage < 60%: 'needs_practice'
  // - If percentage >= 75%: 'steady_progress'
  // - Otherwise: 'developing'
  const topicPerformance: TopicPerformanceStat[] = [];
  let insufficientDataTopicsCount = 0;

  for (const [topic, data] of topicStatsMap.entries()) {
    const percentage = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
    let signal: TopicPerformanceStat['signal'] = 'developing';

    if (data.attempts < 3) {
      signal = 'insufficient_data';
      insufficientDataTopicsCount++;
    } else if (percentage < 60) {
      signal = 'needs_practice';
    } else if (percentage >= 75) {
      signal = 'steady_progress';
    }

    topicPerformance.push({
      topic,
      system: data.system,
      attemptsCount: data.attempts,
      correctCount: data.correct,
      percentage,
      signal,
    });
  }

  // Sort topics by attempts descending
  topicPerformance.sort((a, b) => b.attemptsCount - a.attemptsCount);

  // 3. Weekly Activity Summary (past 4 weeks)
  const weeklyActivity: WeeklyActivitySummary[] = [];
  const now = new Date();
  
  for (let w = 3; w >= 0; w--) {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (w * 7 + now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startTs = startOfWeek.getTime();
    const endTs = endOfWeek.getTime();

    const activeDaysSet = new Set<string>();
    let weekQuestions = 0;

    for (const session of completedSessions) {
      if (session.completedAt && session.completedAt >= startTs && session.completedAt <= endTs) {
        const dateKey = new Date(session.completedAt).toISOString().slice(0, 10);
        activeDaysSet.add(dateKey);
        for (const q of session.questionSnapshots) {
          if (session.answers[q.id]?.selectedOptionId) {
            weekQuestions++;
          }
        }
      }
    }

    const monthName = startOfWeek.toLocaleDateString(undefined, { month: 'short' });
    weeklyActivity.push({
      weekLabel: `Week of ${monthName} ${startOfWeek.getDate()}`,
      startDate: startOfWeek.toISOString().slice(0, 10),
      endDate: endOfWeek.toISOString().slice(0, 10),
      questionsCount: weekQuestions,
      activeDaysCount: activeDaysSet.size,
    });
  }

  return {
    totalAttempts,
    uniqueQuestionsAttempted,
    firstAttemptAccuracy: {
      correct: firstAttemptCorrect,
      denominator: firstAttemptDenominator,
      percentage: firstAttemptPercentage,
    },
    repeatAttemptAccuracy: {
      correct: repeatAttemptCorrect,
      denominator: repeatAttemptDenominator,
      percentage: repeatAttemptPercentage,
    },
    weeklyActivity,
    topicPerformance,
    insufficientDataTopicsCount,
  };
}
