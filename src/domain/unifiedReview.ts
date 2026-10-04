/**
 * Unified Learner Review System
 * 
 * Unifies the learner-facing review experience while preserving distinct
 * question-attempt and personal-card scheduling semantics:
 * 1. Includes:
 *    - Incorrectly answered questions
 *    - Explicitly guessed / unsure answers (NEVER inferred from answer speed)
 *    - Items intentionally saved by the student (questions or Discover concepts)
 *    - Personal flashcards created by the student
 * 2. De-duplicates learning items: if an item exists in both reviewQueue and flashcards,
 *    it appears ONCE in the unified learner review interface.
 * 3. Question-derived items retain:
 *    - Versioned source snapshot (vignette, prompt, options, explanation, metadata)
 *    - Submitted answer and confidence
 *    - Does NOT expose the answer before recall (requires explicit reveal)
 *    - Offers "Retry Question" (scheduled via question scheduler) or rating.
 * 4. Personal cards:
 *    - Retain front/back editing.
 *    - Plain rating labels: Again / Hard / Remembered.
 *    - Revealing a card does NOT mark mastery; only applying a rating updates repetitions & due date.
 */

import type {
  Question,
  Flashcard,
  ReviewQueueItem,
  ConfidenceLevel,
  ContentKind,
  EducationalMedia,
  SourceReference,
  DiscoverCard,
} from './types';

export type UnifiedReviewItemType = 'question' | 'discover' | 'personal';

export interface UnifiedReviewItem {
  id: string; // Unique combined key
  itemType: UnifiedReviewItemType;
  dueAt: number;
  intervalDays: number;
  repetitions: number;
  topic: string;
  sourceKind: ContentKind;
  
  // Backing store linkage
  reviewQueueItemId?: string;
  flashcardId?: string;
  
  // Question-derived card fields
  sourceQuestionId?: string;
  sourceQuestionVersion?: number;
  questionSnapshot?: Question;
  submittedOptionId?: string | null;
  confidence?: ConfidenceLevel;
  
  // Discover-derived card fields
  sourceDiscoverCardId?: string;
  sourceDiscoverVersion?: number;
  discoverSnapshot?: DiscoverCard;
  curiosityPrompt?: string;
  revealedConcept?: string;
  conciseExplanation?: string;
  whyItMatters?: string;
  diagram?: EducationalMedia;
  sourceReference?: SourceReference;

  // Personal card fields
  front?: string;
  back?: string;
  isPersonalCard?: boolean;
}

/**
 * Builds a unified, de-duplicated queue of items due for review.
 * Never infers guessing from answer speed.
 */
export function buildUnifiedReviewQueue(
  flashcards: Flashcard[],
  reviewQueueItems: ReviewQueueItem[],
  allQuestions: Question[],
  now = Date.now()
): UnifiedReviewItem[] {
  const questionMap = new Map<string, Question>(allQuestions.map((q) => [q.id, q]));
  const unifiedItems: UnifiedReviewItem[] = [];
  const processedQuestionIds = new Set<string>();

  // 1. Process Flashcards (Personal, Question-derived, Discover-derived)
  for (const card of flashcards) {
    if (card.dueAt > now) continue; // Only include due cards in active queue

    if (card.cardKind === 'question_derived' && card.sourceQuestionId) {
      processedQuestionIds.add(card.sourceQuestionId);

      // Find if there is also an active reviewQueue item for this question
      const matchingQueueItem = reviewQueueItems.find(
        (rq) => rq.questionId === card.sourceQuestionId && rq.status === 'pending'
      );

      const qSnapshot = card.questionSnapshot || questionMap.get(card.sourceQuestionId);

      unifiedItems.push({
        id: `unified-q-${card.sourceQuestionId}`,
        itemType: 'question',
        dueAt: card.dueAt,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        topic: card.topic || qSnapshot?.topic || 'Question Review',
        sourceKind: qSnapshot?.contentKind || 'educational',
        flashcardId: card.id,
        reviewQueueItemId: matchingQueueItem?.id,
        sourceQuestionId: card.sourceQuestionId,
        sourceQuestionVersion: card.sourceQuestionVersion || qSnapshot?.version,
        questionSnapshot: qSnapshot,
        submittedOptionId: card.submittedOptionId,
        confidence: card.confidence,
      });
    } else if (card.cardKind === 'discover_derived' && card.sourceDiscoverCardId) {
      const disc = card.discoverSnapshot;
      unifiedItems.push({
        id: `unified-disc-${card.sourceDiscoverCardId}`,
        itemType: 'discover',
        dueAt: card.dueAt,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        topic: card.topic || disc?.curriculumMapping.topic || 'Discover Concept',
        sourceKind: disc?.contentKind || 'educational',
        flashcardId: card.id,
        sourceDiscoverCardId: card.sourceDiscoverCardId,
        sourceDiscoverVersion: card.sourceDiscoverVersion || disc?.version,
        discoverSnapshot: disc,
        curiosityPrompt: disc?.curiosityPrompt || card.front,
        revealedConcept: disc?.revealedConcept || card.topic,
        conciseExplanation: disc?.conciseExplanation || card.back,
        whyItMatters: disc?.whyItMatters,
        diagram: disc?.diagram,
        sourceReference: disc?.sourceReference,
      });
    } else {
      // Personal card
      unifiedItems.push({
        id: `unified-fc-${card.id}`,
        itemType: 'personal',
        dueAt: card.dueAt,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        topic: card.topic || 'Personal Note',
        sourceKind: 'personal' as any,
        flashcardId: card.id,
        front: card.front,
        back: card.back,
        isPersonalCard: true,
      });
    }
  }

  // 2. Process ReviewQueue items not already merged with a flashcard
  for (const item of reviewQueueItems) {
    if (item.status !== 'pending' || item.dueAt > now) continue;
    if (processedQuestionIds.has(item.questionId)) continue; // Already merged with flashcard!

    processedQuestionIds.add(item.questionId);
    const qSnapshot = questionMap.get(item.questionId);
    if (!qSnapshot) continue; // Orphan item, cannot resolve

    unifiedItems.push({
      id: `unified-rq-${item.questionId}`,
      itemType: 'question',
      dueAt: item.dueAt,
      intervalDays: item.intervalDays,
      repetitions: item.reviewCount,
      topic: qSnapshot.topic,
      sourceKind: qSnapshot.contentKind,
      reviewQueueItemId: item.id,
      sourceQuestionId: item.questionId,
      sourceQuestionVersion: qSnapshot.version,
      questionSnapshot: qSnapshot,
      confidence: item.reason === 'guessed' ? 'guessed' : item.reason === 'unsure' ? 'unsure' : undefined,
    });
  }

  // Sort: most overdue first (lowest dueAt first)
  return unifiedItems.sort((a, b) => a.dueAt - b.dueAt);
}
