/**
 * Daily Habit & Streak Domain Logic for WardWit
 *
 * Requirements:
 * - Target: 5 distinct question answers submitted or 5 distinct due review items completed
 *   (or combination totaling 5) within the study day (Asia/Karachi).
 * - Correctness is NOT required (separate from question accuracy).
 * - A review question counts ONCE, not as both an answer and a review item.
 * - Opening the app, reading Discover, or repeatedly practicing the same item cannot farm credit.
 * - Tutor answers count when durably submitted; timed answers when block is finalized.
 * - Stable canonical IDs prevent retries or duplicate callbacks from double-crediting.
 * - Yesterday's streak remains current while today is still available; a missed full day breaks it.
 * - Returning users get a welcoming restart, never a guilt message.
 */

import type { DailyActivityRecord } from './types';
import {
  getKarachiDayKey,
  getPreviousDayKey,
  getNextDayKey,
  getKarachiWeekDays,
  type WeekDayInfo,
} from './studyDay';

export const DAILY_HABIT_GOAL = 5;

/**
 * Creates canonical ID for a question attempt.
 */
export function canonicalizeQuestionId(questionId: string): string {
  return `q:${questionId}`;
}

/**
 * Creates canonical ID for a flashcard or review item.
 * If the item is question-derived, it shares the exact canonical ID `q:${questionId}`
 * ensuring a question is counted once regardless of whether practiced as question or review card.
 */
export function canonicalizeReviewItem(item: {
  id?: string;
  questionId?: string;
  sourceQuestionId?: string;
  sourceDiscoverId?: string;
  sourceDiscoverCardId?: string;
  flashcardId?: string;
}): string {
  if (item.questionId) {
    return `q:${item.questionId}`;
  }
  if (item.sourceQuestionId) {
    return `q:${item.sourceQuestionId}`;
  }
  if (item.sourceDiscoverId || item.sourceDiscoverCardId) {
    return `disc:${item.sourceDiscoverId || item.sourceDiscoverCardId}`;
  }
  if (item.flashcardId) {
    return `fc:${item.flashcardId}`;
  }
  return `fc:${item.id || 'unknown'}`;
}

export interface QualifyingRecordUpdateResult {
  record: DailyActivityRecord;
  wasNewAction: boolean;
  justQualified: boolean;
}

/**
 * Pure domain function to add a single distinct canonical item to a study day's record.
 * Idempotently deduplicates by canonical item ID.
 */
export function recordQualifyingItem(
  existing: DailyActivityRecord | null,
  dayKey: string,
  canonicalItemId: string,
  statsDelta?: {
    questionsAnswered?: number;
    correctCount?: number;
    sessionsCompleted?: number;
    flashcardsReviewed?: number;
  },
  now = Date.now()
): QualifyingRecordUpdateResult {
  const currentItemIds = existing?.qualifyingItemIds ? [...existing.qualifyingItemIds] : [];
  const wasNewAction = !currentItemIds.includes(canonicalItemId);

  if (wasNewAction) {
    currentItemIds.push(canonicalItemId);
  }

  const priorCount = existing?.qualifyingCount ?? (existing?.qualifyingItemIds?.length ?? 0);
  const newQualifyingCount = currentItemIds.length;
  const isGoalMet = newQualifyingCount >= DAILY_HABIT_GOAL;
  const justQualified = wasNewAction && priorCount < DAILY_HABIT_GOAL && isGoalMet;

  const updatedRecord: DailyActivityRecord = {
    date: dayKey,
    questionsAnswered: Math.max(0, (existing?.questionsAnswered || 0) + (statsDelta?.questionsAnswered || 0)),
    correctCount: Math.max(0, (existing?.correctCount || 0) + (statsDelta?.correctCount || 0)),
    sessionsCompleted: (existing?.sessionsCompleted || 0) + (statsDelta?.sessionsCompleted || 0),
    flashcardsReviewed: Math.max(0, (existing?.flashcardsReviewed || 0) + (statsDelta?.flashcardsReviewed || 0)),
    qualifyingItemIds: currentItemIds,
    qualifyingCount: newQualifyingCount,
    goalMet: isGoalMet,
    updatedAt: now,
  };

  return {
    record: updatedRecord,
    wasNewAction,
    justQualified,
  };
}

/**
 * Pure domain function to add a batch of distinct canonical items (e.g. at timed block finalization).
 */
export function recordQualifyingBatch(
  existing: DailyActivityRecord | null,
  dayKey: string,
  canonicalItemIds: string[],
  statsDelta?: {
    questionsAnswered?: number;
    correctCount?: number;
    sessionsCompleted?: number;
    flashcardsReviewed?: number;
  },
  now = Date.now()
): { record: DailyActivityRecord; newActionsCount: number; justQualified: boolean } {
  const currentSet = new Set(existing?.qualifyingItemIds || []);
  let newActionsCount = 0;

  for (const id of canonicalItemIds) {
    if (!currentSet.has(id)) {
      currentSet.add(id);
      newActionsCount++;
    }
  }

  const newItemIds = Array.from(currentSet);
  const priorCount = existing?.qualifyingCount ?? (existing?.qualifyingItemIds?.length ?? 0);
  const newQualifyingCount = newItemIds.length;
  const isGoalMet = newQualifyingCount >= DAILY_HABIT_GOAL;
  const justQualified = newActionsCount > 0 && priorCount < DAILY_HABIT_GOAL && isGoalMet;

  const updatedRecord: DailyActivityRecord = {
    date: dayKey,
    questionsAnswered: Math.max(0, (existing?.questionsAnswered || 0) + (statsDelta?.questionsAnswered || 0)),
    correctCount: Math.max(0, (existing?.correctCount || 0) + (statsDelta?.correctCount || 0)),
    sessionsCompleted: (existing?.sessionsCompleted || 0) + (statsDelta?.sessionsCompleted || 0),
    flashcardsReviewed: Math.max(0, (existing?.flashcardsReviewed || 0) + (statsDelta?.flashcardsReviewed || 0)),
    qualifyingItemIds: newItemIds,
    qualifyingCount: newQualifyingCount,
    goalMet: isGoalMet,
    updatedAt: now,
  };

  return {
    record: updatedRecord,
    newActionsCount,
    justQualified,
  };
}

export interface WeekStripDay extends WeekDayInfo {
  isQualified: boolean;
  qualifyingCount: number;
}

export interface StreakState {
  currentStreak: number;
  bestStreak: number;
  todayCount: number;
  todayGoal: number;
  todayQualified: boolean;
  yesterdayQualified: boolean;
  qualifyingDates: string[];
  weekDays: WeekStripDay[];
  statusMessage: string;
}

/**
 * Computes current streak, best streak, and today's habit status from persisted activity records.
 *
 * Migration Note:
 * Older aggregate activity records lacking `qualifyingItemIds` are not assumed to have qualified
 * under this 5-distinct-action rule to prevent fabricating past streak days from ambiguous data.
 */
export function computeStreakState(
  records: DailyActivityRecord[],
  todayKey: string = getKarachiDayKey()
): StreakState {
  // Collect verified qualifying dates
  const qualifyingDateSet = new Set<string>();
  const recordMap = new Map<string, DailyActivityRecord>();

  for (const r of records) {
    recordMap.set(r.date, r);
    // Explicitly verify qualification
    if (r.goalMet === true || (r.qualifyingItemIds && r.qualifyingItemIds.length >= DAILY_HABIT_GOAL)) {
      qualifyingDateSet.add(r.date);
    }
  }

  const todayRecord = recordMap.get(todayKey);
  const todayCount = todayRecord?.qualifyingCount ?? (todayRecord?.qualifyingItemIds?.length ?? 0);
  const todayQualified = qualifyingDateSet.has(todayKey);

  const yesterdayKey = getPreviousDayKey(todayKey);
  const yesterdayQualified = qualifyingDateSet.has(yesterdayKey);

  // Current Streak Calculation:
  // - If today qualified: count today + consecutive preceding days
  // - If today incomplete: yesterday's streak remains current while today is still available
  // - If neither today nor yesterday qualified: streak is broken (0)
  let currentStreak = 0;
  if (todayQualified) {
    currentStreak = 1;
    let checkKey = yesterdayKey;
    while (qualifyingDateSet.has(checkKey)) {
      currentStreak++;
      checkKey = getPreviousDayKey(checkKey);
    }
  } else if (yesterdayQualified) {
    currentStreak = 1;
    let checkKey = getPreviousDayKey(yesterdayKey);
    while (qualifyingDateSet.has(checkKey)) {
      currentStreak++;
      checkKey = getPreviousDayKey(checkKey);
    }
  } else {
    currentStreak = 0;
  }

  // Best Streak Calculation:
  // Find longest contiguous run across all qualifying dates
  let bestStreak = currentStreak;
  const sortedDates = Array.from(qualifyingDateSet).sort();
  if (sortedDates.length > 0) {
    let streak = 0;
    let expectedNext = '';
    for (const d of sortedDates) {
      if (d === expectedNext) {
        streak++;
      } else {
        streak = 1;
      }
      if (streak > bestStreak) {
        bestStreak = streak;
      }
      expectedNext = getNextDayKey(d);
    }
  }

  // Week strip calculation for the week containing today
  const rawWeekDays = getKarachiWeekDays(todayKey, todayKey);
  const weekDays: WeekStripDay[] = rawWeekDays.map((wd) => {
    const dayRec = recordMap.get(wd.dateKey);
    const dayCount = dayRec?.qualifyingCount ?? (dayRec?.qualifyingItemIds?.length ?? 0);
    const isQual = qualifyingDateSet.has(wd.dateKey);
    return {
      ...wd,
      isQualified: isQual,
      qualifyingCount: dayCount,
    };
  });

  // Welcoming status message (no pressure, no guilt)
  let statusMessage = '';
  if (currentStreak === 0) {
    statusMessage = 'Welcome back! Complete 5 questions or reviews today to start your streak.';
  } else if (todayQualified) {
    statusMessage = `${currentStreak}-day streak secured! Daily goal accomplished.`;
  } else {
    const remaining = Math.max(0, DAILY_HABIT_GOAL - todayCount);
    statusMessage = `${currentStreak}-day streak active. ${remaining} more ${remaining === 1 ? 'action' : 'actions'} needed today to keep it going!`;
  }

  return {
    currentStreak,
    bestStreak,
    todayCount,
    todayGoal: DAILY_HABIT_GOAL,
    todayQualified,
    yesterdayQualified,
    qualifyingDates: Array.from(qualifyingDateSet).sort(),
    weekDays,
    statusMessage,
  };
}
