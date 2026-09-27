/**
 * Basic Spaced Review System for WardWit
 * 
 * NOTE: This is a basic 4-stage interval review system (1d, 3d, 7d, 14d),
 * not an AI-powered or clinically validated algorithm.
 */

import type { Question, ReviewQueueItem, ReviewItemReason } from './types';

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14];

/**
 * Creates a new ReviewQueueItem scheduled for review in 1 day.
 */
export function createReviewQueueItem(
  questionId: string,
  conceptId?: string,
  reason: ReviewItemReason = 'incorrect',
  now = Date.now()
): ReviewQueueItem {
  const initialInterval = REVIEW_INTERVAL_DAYS[0]; // 1 day
  return {
    id: `rev-${questionId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
    questionId,
    conceptId,
    reason,
    addedAt: now,
    dueAt: now + initialInterval * 24 * 60 * 60 * 1000,
    intervalDays: initialInterval,
    reviewCount: 0,
    status: 'pending',
  };
}

/**
 * Updates a review item after the student reviews it.
 * If passed (answered correctly), advance to next interval;
 * if failed, reset to 1-day interval.
 */
export function recordReviewAttempt(
  item: ReviewQueueItem,
  isCorrect: boolean,
  now = Date.now()
): ReviewQueueItem {
  if (!isCorrect) {
    // Reset to stage 0 (1 day)
    const intervalDays = REVIEW_INTERVAL_DAYS[0];
    return {
      ...item,
      intervalDays,
      dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
      reviewCount: item.reviewCount + 1,
      lastReviewedAt: now,
      status: 'pending',
    };
  }

  // Find next interval in ladder
  const currentIdx = REVIEW_INTERVAL_DAYS.indexOf(item.intervalDays);
  const nextIdx = currentIdx >= 0 && currentIdx < REVIEW_INTERVAL_DAYS.length - 1
    ? currentIdx + 1
    : currentIdx;
  const intervalDays = REVIEW_INTERVAL_DAYS[nextIdx];

  // If graduated past 14 days, mark completed or keep at 14d
  const isGraduated = currentIdx === REVIEW_INTERVAL_DAYS.length - 1;

  return {
    ...item,
    intervalDays,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
    reviewCount: item.reviewCount + 1,
    lastReviewedAt: now,
    status: isGraduated ? 'completed' : 'pending',
  };
}

/**
 * Returns items currently due for review (dueAt <= now and status === 'pending').
 */
export function getDueReviewItems(items: ReviewQueueItem[], now = Date.now()): ReviewQueueItem[] {
  return items.filter((item) => item.status === 'pending' && item.dueAt <= now);
}

export interface ReviewQuestionResolution {
  question: Question;
  isOriginal: boolean;
  conceptId?: string;
}

/**
 * Resolves a question for a review queue item:
 * If an alternate approved question with the same conceptId exists, offer it;
 * otherwise return the original question and indicate that the original is being repeated.
 */
export function resolveReviewQuestion(
  item: ReviewQueueItem,
  allApprovedQuestions: Question[]
): ReviewQuestionResolution | null {
  const original = allApprovedQuestions.find((q) => q.id === item.questionId);
  if (!original) return null;

  if (item.conceptId) {
    const alternate = allApprovedQuestions.find(
      (q) => q.conceptId === item.conceptId && q.id !== item.questionId && q.editorialStatus === 'approved'
    );
    if (alternate) {
      return { question: alternate, isOriginal: false, conceptId: item.conceptId };
    }
  }

  return { question: original, isOriginal: true, conceptId: item.conceptId };
}
