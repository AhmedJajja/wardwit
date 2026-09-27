import { describe, it, expect } from 'vitest';
import {
  createReviewQueueItem,
  recordReviewAttempt,
  getDueReviewItems,
  resolveReviewQuestion,
  REVIEW_INTERVAL_DAYS,
} from '../domain/spacedReview';
import { DEMO_QUESTIONS } from '../config/demoQuestions';

describe('Spaced Review Queue System', () => {
  it('creates an item with 1-day initial due date', () => {
    const now = 1000000;
    const item = createReviewQueueItem('demo-001', 'concept-test', 'incorrect', now);

    expect(item.questionId).toBe('demo-001');
    expect(item.intervalDays).toBe(1);
    expect(item.dueAt).toBe(now + 1 * 24 * 60 * 60 * 1000);
    expect(item.status).toBe('pending');
  });

  it('progresses intervals on correct reviews (1d -> 3d -> 7d -> 14d)', () => {
    const now = 1000000;
    let item = createReviewQueueItem('demo-001', undefined, 'incorrect', now);

    // 1st correct review -> advances to 3 days
    item = recordReviewAttempt(item, true, now);
    expect(item.intervalDays).toBe(REVIEW_INTERVAL_DAYS[1]); // 3 days

    // 2nd correct review -> advances to 7 days
    item = recordReviewAttempt(item, true, now);
    expect(item.intervalDays).toBe(REVIEW_INTERVAL_DAYS[2]); // 7 days

    // 3rd correct review -> advances to 14 days
    item = recordReviewAttempt(item, true, now);
    expect(item.intervalDays).toBe(REVIEW_INTERVAL_DAYS[3]); // 14 days
    expect(item.status).toBe('pending');

    // 4th correct review (after 14-day interval) -> graduates and marks completed
    item = recordReviewAttempt(item, true, now);
    expect(item.status).toBe('completed');
  });

  it('resets interval back to 1 day on failed review', () => {
    const now = 1000000;
    let item = createReviewQueueItem('demo-001', undefined, 'incorrect', now);

    // Advance to 7 days
    item = recordReviewAttempt(item, true, now);
    item = recordReviewAttempt(item, true, now);
    expect(item.intervalDays).toBe(7);

    // Incorrect answer resets interval to 1 day
    item = recordReviewAttempt(item, false, now);
    expect(item.intervalDays).toBe(1);
    expect(item.dueAt).toBe(now + 1 * 24 * 60 * 60 * 1000);
    expect(item.status).toBe('pending');
  });

  it('filters due review items accurately', () => {
    const now = 5000000;
    const dueItem = {
      ...createReviewQueueItem('demo-001', undefined, 'incorrect', now - 2 * 86400000),
      dueAt: now - 1000, // Due in past
    };
    const futureItem = {
      ...createReviewQueueItem('demo-002', undefined, 'incorrect', now),
      dueAt: now + 86400000, // Due tomorrow
    };

    const dueList = getDueReviewItems([dueItem, futureItem], now);
    expect(dueList.length).toBe(1);
    expect(dueList[0].questionId).toBe('demo-001');
  });

  it('resolves review questions and explicitly indicates when original is repeated', () => {
    const item = createReviewQueueItem('demo-001', 'concept-sensitivity-cutoff');
    const resolution = resolveReviewQuestion(item, DEMO_QUESTIONS);

    expect(resolution).not.toBeNull();
    expect(resolution?.question.id).toBe('demo-001');
    // Since only 1 question exists with this concept in demo bank, it reports isOriginal: true
    expect(resolution?.isOriginal).toBe(true);
  });
});
