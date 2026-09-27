/**
 * Flashcard Spaced Repetition Logic for WardWit
 */

import type { Flashcard, CardRating, CardKind } from './types';

export function createFlashcard(
  front: string,
  back: string,
  cardKind: CardKind = 'personal',
  options?: {
    sourceQuestionId?: string;
    sourceNoteId?: string;
    topic?: string;
  },
  now = Date.now()
): Flashcard {
  return {
    id: `fc-${now}-${Math.random().toString(36).slice(2, 6)}`,
    front: front.trim(),
    back: back.trim(),
    cardKind,
    sourceQuestionId: options?.sourceQuestionId,
    sourceNoteId: options?.sourceNoteId,
    topic: options?.topic || 'General Review',
    intervalDays: 1,
    dueAt: now, // immediately available for first study
    repetitions: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function reviewFlashcard(
  card: Flashcard,
  rating: CardRating,
  now = Date.now()
): Flashcard {
  let intervalDays = 1;
  let repetitions = card.repetitions;

  switch (rating) {
    case 'again':
      intervalDays = 1;
      repetitions = 0;
      break;
    case 'difficult':
      intervalDays = Math.max(1, Math.round(card.intervalDays * 1.3));
      repetitions += 1;
      break;
    case 'remembered':
      if (repetitions === 0) {
        intervalDays = 1;
      } else if (repetitions === 1) {
        intervalDays = 3;
      } else {
        intervalDays = Math.round(card.intervalDays * 2.4);
      }
      repetitions += 1;
      break;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return {
    ...card,
    intervalDays,
    dueAt: now + intervalDays * dayMs,
    repetitions,
    lastReviewedAt: now,
    updatedAt: now,
  };
}

export function getDueFlashcards(cards: Flashcard[], now = Date.now()): Flashcard[] {
  return cards.filter((c) => c.dueAt <= now);
}
