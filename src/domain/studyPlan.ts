/**
 * Daily Study Plan Logic for WardWit
 * 
 * Simple, transparent planning rule based on:
 * 1) Daily question goal vs recorded local attempts today.
 * 2) Selected study days (with non-punitive rest-day indicator).
 * 3) Review queue due count.
 * 4) Available unused questions in bank.
 */

import type { UserProfile, DailyActivityRecord, StudySession, Question, ReviewQueueItem } from './types';
import { getDueReviewItems } from './spacedReview';

export interface DailyStudyPlan {
  todayDateStr: string;
  isPlannedStudyDay: boolean;
  dayName: string;
  dailyGoal: number;
  questionsAnsweredToday: number;
  remainingGoal: number;
  goalReached: boolean;
  dueReviewsCount: number;
  availableUnusedCount: number;
  hasUnfinishedSession: boolean;
  unfinishedSessionId?: string;
  canLaunchQuickSprint: boolean; // At least 5 questions available in pool
  bankCapacityNote?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function generateDailyStudyPlan(
  profile: UserProfile,
  todayActivity: DailyActivityRecord | null,
  activeSession: StudySession | null,
  allApprovedQuestions: Question[],
  historyAnsweredQuestionIds: Set<string>,
  reviewQueue: ReviewQueueItem[],
  now = new Date()
): DailyStudyPlan {
  const dayIndex = now.getDay();
  const dayName = DAY_NAMES[dayIndex];
  const isPlannedStudyDay = (profile.preferredStudyDays || []).includes(dayName);

  const dailyGoal = profile.dailyQuestionGoal || 10;
  const questionsAnsweredToday = todayActivity?.questionsAnswered || 0;
  const remainingGoal = Math.max(0, dailyGoal - questionsAnsweredToday);
  const goalReached = questionsAnsweredToday >= dailyGoal;

  const dueReviews = getDueReviewItems(reviewQueue, now.getTime());
  const dueReviewsCount = dueReviews.length;

  const unusedCount = allApprovedQuestions.filter(
    (q) => !historyAnsweredQuestionIds.has(q.id) && q.editorialStatus === 'approved'
  ).length;

  const canLaunchQuickSprint = allApprovedQuestions.filter((q) => q.editorialStatus === 'approved').length >= 5;

  let bankCapacityNote: string | undefined;
  if (remainingGoal > allApprovedQuestions.length) {
    bankCapacityNote = `The local question bank currently has ${allApprovedQuestions.length} approved questions, which is less than your daily remaining goal of ${remainingGoal}. You can adjust your goal in Settings or import additional questions via the Content Workspace.`;
  }

  return {
    todayDateStr: now.toISOString().slice(0, 10),
    isPlannedStudyDay,
    dayName,
    dailyGoal,
    questionsAnsweredToday,
    remainingGoal,
    goalReached,
    dueReviewsCount,
    availableUnusedCount: unusedCount,
    hasUnfinishedSession: Boolean(activeSession && activeSession.status === 'in-progress'),
    unfinishedSessionId: activeSession?.id,
    canLaunchQuickSprint,
    bankCapacityNote,
  };
}
