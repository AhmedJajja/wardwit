import { describe, it, expect } from 'vitest';
import { createFlashcard, reviewFlashcard, getDueFlashcards } from '../domain/flashcardReview';

describe('Flashcard Spaced Repetition', () => {
  it('creates personal flashcards ready for initial review', () => {
    const card = createFlashcard(
      'What happens when afterload increases acutely?',
      'End-systolic volume increases, stroke volume decreases.'
    );

    expect(card.front).toBe('What happens when afterload increases acutely?');
    expect(card.cardKind).toBe('personal');
    expect(card.intervalDays).toBe(1);
    expect(card.repetitions).toBe(0);
  });

  it('updates review intervals for again, difficult, and remembered', () => {
    const now = 1000000;
    const card = createFlashcard('Front', 'Back', 'personal', undefined, now);

    // 1st rating: remembered
    const step1 = reviewFlashcard(card, 'remembered', now);
    expect(step1.repetitions).toBe(1);
    expect(step1.intervalDays).toBe(1);

    // 2nd rating: remembered -> 3 days
    const step2 = reviewFlashcard(step1, 'remembered', now);
    expect(step2.repetitions).toBe(2);
    expect(step2.intervalDays).toBe(3);

    // 3rd rating: difficult -> moderate growth
    const step3 = reviewFlashcard(step2, 'difficult', now);
    expect(step3.intervalDays).toBeGreaterThanOrEqual(3);

    // rating: again -> resets to 1 day
    const reset = reviewFlashcard(step3, 'again', now);
    expect(reset.repetitions).toBe(0);
    expect(reset.intervalDays).toBe(1);
  });

  it('correctly filters due flashcards', () => {
    const now = 5000000;
    const dueCard = { ...createFlashcard('Front 1', 'Back 1'), dueAt: now - 1000 };
    const futureCard = { ...createFlashcard('Front 2', 'Back 2'), dueAt: now + 50000 };

    const due = getDueFlashcards([dueCard, futureCard], now);
    expect(due.length).toBe(1);
    expect(due[0].front).toBe('Front 1');
  });
});
