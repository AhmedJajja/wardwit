/**
 * Basic Spaced Review System for WardWit
 * 
 * NOTE: This is a basic 4-stage interval review system (1d, 3d, 7d, 14d),
 * not an AI-powered or clinically validated algorithm.
 */

import type {
  Question,
  ReviewQueueItem,
  ReviewItemReason,
  ConfidenceLevel,
  ReviewQuestionMapping,
} from './types';

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
 * - If incorrect or marked guessed/unsure: keep in practice at stage 0 (1 day), never graduate.
 * - If correct with high/medium confidence: advance to next interval.
 *   Graduates to 'completed' after passing the final 14-day stage.
 * 
 * Supports polymorphic arguments for backward compatibility:
 * recordReviewAttempt(item, isCorrect, confidence?, now?)
 * recordReviewAttempt(item, isCorrect, now?)
 */
export function recordReviewAttempt(
  item: ReviewQueueItem,
  isCorrect: boolean,
  confidenceOrNow?: ConfidenceLevel | number,
  maybeNow?: number
): ReviewQueueItem {
  let confidence: ConfidenceLevel | undefined;
  let now: number;

  if (typeof confidenceOrNow === 'number') {
    now = confidenceOrNow;
  } else {
    confidence = confidenceOrNow;
    now = typeof maybeNow === 'number' ? maybeNow : Date.now();
  }

  const isGuessedOrUnsure = confidence === 'guessed' || confidence === 'unsure';

  // If failed OR guessed/unsure, keep in practice at stage 0 (1 day), never graduate
  if (!isCorrect || isGuessedOrUnsure) {
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

  // If graduated past 14 days, mark completed
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
 * - Preserves demo versus educational content boundaries (never mix kinds).
 * - Deterministically selects an alternate approved question with matching conceptId if available.
 * - Otherwise returns the original question.
 * - Returns null if the item cannot be resolved (original question not found).
 */
export function resolveReviewQuestion(
  item: ReviewQueueItem,
  allApprovedQuestions: Question[]
): ReviewQuestionResolution | null {
  const original = allApprovedQuestions.find((q) => q.id === item.questionId);
  if (!original) return null;

  const originalKind = original.contentKind || 'educational';

  if (item.conceptId) {
    // Find candidate alternates preserving contentKind and approved status
    const candidateAlternates = allApprovedQuestions
      .filter(
        (q) =>
          q.conceptId === item.conceptId &&
          q.id !== item.questionId &&
          q.editorialStatus === 'approved' &&
          (q.contentKind || 'educational') === originalKind
      )
      .sort((a, b) => a.id.localeCompare(b.id)); // Deterministic ordering

    if (candidateAlternates.length > 0) {
      return { question: candidateAlternates[0], isOriginal: false, conceptId: item.conceptId };
    }
  }

  return { question: original, isOriginal: true, conceptId: item.conceptId };
}

export interface DueReviewSessionPlan {
  questions: Question[];
  reviewMappings: Record<string, ReviewQuestionMapping>;
  unresolvableItemIds: string[];
}

/**
 * Builds an explicit, deterministic plan for a due-review session:
 * - Maps each displayed review question to originating review queue item(s).
 * - Handles multiple items resolving to the same question deterministically by grouping item IDs.
 * - Filters and logs unresolvable items without silently crediting completion.
 */
export function buildDueReviewSessionPlan(
  dueItems: ReviewQueueItem[],
  allApprovedQuestions: Question[]
): DueReviewSessionPlan {
  const questionMap = new Map<string, Question>();
  const reviewMappings: Record<string, ReviewQuestionMapping> = {};
  const unresolvableItemIds: string[] = [];

  // Sort due items deterministically by dueAt then id
  const sortedItems = [...dueItems].sort((a, b) => {
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    return a.id.localeCompare(b.id);
  });

  for (const item of sortedItems) {
    const resolution = resolveReviewQuestion(item, allApprovedQuestions);
    if (!resolution) {
      unresolvableItemIds.push(item.id);
      continue;
    }

    const { question, isOriginal } = resolution;
    const qId = question.id;

    if (!questionMap.has(qId)) {
      questionMap.set(qId, question);
      reviewMappings[qId] = {
        questionId: qId,
        originatingItemIds: [item.id],
        originalQuestionIds: [item.questionId],
        wasAlternate: !isOriginal,
      };
    } else {
      // Multiple items resolved to the same question: group them deterministically
      const existingMapping = reviewMappings[qId];
      if (!existingMapping.originatingItemIds.includes(item.id)) {
        existingMapping.originatingItemIds.push(item.id);
        existingMapping.originatingItemIds.sort();
      }
      if (!existingMapping.originalQuestionIds.includes(item.questionId)) {
        existingMapping.originalQuestionIds.push(item.questionId);
        existingMapping.originalQuestionIds.sort();
      }
      if (!isOriginal) {
        existingMapping.wasAlternate = true;
      }
    }
  }

  return {
    questions: Array.from(questionMap.values()),
    reviewMappings,
    unresolvableItemIds,
  };
}
