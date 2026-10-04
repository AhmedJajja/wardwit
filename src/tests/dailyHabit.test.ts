/**
 * Tests for Daily Habit & Streak Phase in WardWit
 *
 * Verifies:
 * - Asia/Karachi 23:59 -> 00:00 midnight transitions
 * - Answers around midnight credited to respective Pakistan calendar days
 * - Yesterday qualified / today incomplete preserves streak
 * - Missed full day breaks current streak while preserving best streak
 * - Welcoming restart message without guilt or pressure
 * - Five wrong answers still qualify (habit separate from accuracy)
 * - Repeated practice on same item does not farm credit (distinct canonical item IDs)
 * - Review question counted once, not as both answer and review item
 * - Duplicate event delivery idempotence
 * - Timed block finalization vs tutor durable submission
 * - Full JSON backup export and import preserves qualifying activity and streak history
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  getKarachiDayKey,
  getPreviousDayKey,
  getNextDayKey,
  getMsUntilNextKarachiMidnight,
  getKarachiWeekDays,
} from '../domain/studyDay';
import {
  canonicalizeQuestionId,
  canonicalizeReviewItem,
  recordQualifyingItem,
  recordQualifyingBatch,
  computeStreakState,
} from '../domain/dailyHabit';
import type { DailyActivityRecord } from '../domain/types';
import {
  dailyActivityRepo,
  exportLocalBackup,
  importLocalBackup,
  clearAllLocalData,
} from '../persistence/indexedDbRepo';

describe('Daily Habit & Streak Domain Logic', () => {
  describe('1. Timezone & Study Day (Asia/Karachi)', () => {
    it('correctly maps 23:59:50 vs 00:00:10 Pakistan time boundary', () => {
      // 2026-09-28 23:59:50 PKT corresponds to 2026-09-28 18:59:50 UTC (UTC+5)
      const beforeMidnightUtcMs = Date.UTC(2026, 8, 28, 18, 59, 50, 0);
      expect(getKarachiDayKey(beforeMidnightUtcMs)).toBe('2026-09-28');

      // 2026-09-29 00:00:10 PKT corresponds to 2026-09-28 19:00:10 UTC (UTC+5)
      const afterMidnightUtcMs = Date.UTC(2026, 8, 28, 19, 0, 10, 0);
      expect(getKarachiDayKey(afterMidnightUtcMs)).toBe('2026-09-29');
    });

    it('correctly calculates previous and next day keys across month and year boundaries', () => {
      expect(getPreviousDayKey('2026-09-29')).toBe('2026-09-28');
      expect(getPreviousDayKey('2026-01-01')).toBe('2025-12-31');
      expect(getPreviousDayKey('2024-03-01')).toBe('2024-02-29'); // Leap year
      expect(getPreviousDayKey('2026-03-01')).toBe('2026-02-28'); // Non-leap year

      expect(getNextDayKey('2026-09-28')).toBe('2026-09-29');
      expect(getNextDayKey('2025-12-31')).toBe('2026-01-01');
      expect(getNextDayKey('2024-02-28')).toBe('2024-02-29');
    });

    it('calculates positive milliseconds until the next Karachi midnight', () => {
      const now = Date.UTC(2026, 8, 28, 12, 0, 0); // 17:00 in Karachi
      const msUntilMidnight = getMsUntilNextKarachiMidnight(now);
      // Next midnight in Karachi is 19:00 UTC (7 hours away = 25,200,000 ms)
      expect(msUntilMidnight).toBe(7 * 60 * 60 * 1000);
    });

    it('generates a 7-day Monday-to-Sunday week strip for the active day', () => {
      // 2026-09-28 is a Monday
      const week = getKarachiWeekDays('2026-09-28', '2026-09-28');
      expect(week).toHaveLength(7);
      expect(week[0].dateKey).toBe('2026-09-28');
      expect(week[0].dayName).toBe('Mon');
      expect(week[0].isToday).toBe(true);
      expect(week[6].dateKey).toBe('2026-10-04');
      expect(week[6].dayName).toBe('Sun');
      expect(week[6].isFuture).toBe(true);
    });
  });

  describe('2. Distinct Action Deduplication & Anti-Farming', () => {
    it('repeatedly practicing or rating the same item within the study day counts only once', () => {
      let record: DailyActivityRecord | null = null;
      const day = '2026-09-28';
      const questionId = 'q-demo-bio-01';
      const canonicalId = canonicalizeQuestionId(questionId);

      // Attempt 1
      const res1 = recordQualifyingItem(record, day, canonicalId, { questionsAnswered: 1 });
      record = res1.record;
      expect(res1.wasNewAction).toBe(true);
      expect(record.qualifyingCount).toBe(1);

      // Attempts 2 through 5 on the same question
      for (let i = 2; i <= 5; i++) {
        const res = recordQualifyingItem(record, day, canonicalId, { questionsAnswered: 1 });
        record = res.record;
        expect(res.wasNewAction).toBe(false);
        expect(record.qualifyingCount).toBe(1);
      }

      // 5 submissions of the same question -> only 1 qualifying action; goal is NOT met
      expect(record.qualifyingCount).toBe(1);
      expect(record.goalMet).toBe(false);
      expect(record.questionsAnswered).toBe(5); // Aggregate counts total attempts, but habit requires distinct items
    });

    it('counts a review question once, not as both an answer and a review item', () => {
      let record: DailyActivityRecord | null = null;
      const day = '2026-09-28';
      const qId = 'q-hypertension-001';

      // 1. Answer question in a session
      const qCanonical = canonicalizeQuestionId(qId);
      const res1 = recordQualifyingItem(record, day, qCanonical, { questionsAnswered: 1 });
      record = res1.record;
      expect(record.qualifyingCount).toBe(1);

      // 2. Later review the question as a review card
      const reviewCanonical = canonicalizeReviewItem({
        id: 'fc-derived-123',
        questionId: qId,
        sourceQuestionId: qId,
      });

      // Both must share identical canonical key
      expect(reviewCanonical).toBe(qCanonical);

      const res2 = recordQualifyingItem(record, day, reviewCanonical, { flashcardsReviewed: 1 });
      record = res2.record;
      expect(res2.wasNewAction).toBe(false);
      expect(record.qualifyingCount).toBe(1); // Did not double-count!
    });

    it('qualifies with five wrong answers (habit formation separate from accuracy)', () => {
      let record: DailyActivityRecord | null = null;
      const day = '2026-09-28';

      for (let i = 1; i <= 5; i++) {
        const qId = `q-wrong-${i}`;
        const res = recordQualifyingItem(
          record,
          day,
          canonicalizeQuestionId(qId),
          { questionsAnswered: 1, correctCount: 0 } // 0 correct
        );
        record = res.record;
        if (i < 5) {
          expect(res.justQualified).toBe(false);
          expect(record.goalMet).toBe(false);
        } else {
          expect(res.justQualified).toBe(true);
          expect(record.goalMet).toBe(true);
        }
      }

      expect(record!.qualifyingCount).toBe(5);
      expect(record!.correctCount).toBe(0);
      expect(record!.goalMet).toBe(true);
    });

    it('handles batch qualifying actions at timed block finalization', () => {
      const day = '2026-09-28';
      const batchIds = [
        canonicalizeQuestionId('q-t1'),
        canonicalizeQuestionId('q-t2'),
        canonicalizeQuestionId('q-t3'),
        canonicalizeQuestionId('q-t4'),
        canonicalizeQuestionId('q-t5'),
      ];

      const res = recordQualifyingBatch(null, day, batchIds, {
        questionsAnswered: 5,
        correctCount: 4,
        sessionsCompleted: 1,
      });

      expect(res.newActionsCount).toBe(5);
      expect(res.justQualified).toBe(true);
      expect(res.record.qualifyingCount).toBe(5);
      expect(res.record.goalMet).toBe(true);

      // Re-running finalization or duplicate delivery callback is a no-op
      const resDup = recordQualifyingBatch(res.record, day, batchIds);
      expect(resDup.newActionsCount).toBe(0);
      expect(resDup.justQualified).toBe(false);
      expect(resDup.record.qualifyingCount).toBe(5);
    });
  });

  describe('3. Streak Computation & Grace Rules', () => {
    it('preserves yesterday’s streak when today is still available to complete', () => {
      const records: DailyActivityRecord[] = [
        {
          date: '2026-09-27', // Yesterday
          questionsAnswered: 5,
          correctCount: 4,
          sessionsCompleted: 1,
          qualifyingItemIds: ['q:1', 'q:2', 'q:3', 'q:4', 'q:5'],
          qualifyingCount: 5,
          goalMet: true,
        },
        {
          date: '2026-09-28', // Today (only 2 actions done so far)
          questionsAnswered: 2,
          correctCount: 2,
          sessionsCompleted: 0,
          qualifyingItemIds: ['q:10', 'q:11'],
          qualifyingCount: 2,
          goalMet: false,
        },
      ];

      const state = computeStreakState(records, '2026-09-28');
      expect(state.currentStreak).toBe(1); // Preserved from yesterday
      expect(state.todayQualified).toBe(false);
      expect(state.yesterdayQualified).toBe(true);
      expect(state.todayCount).toBe(2);
      expect(state.statusMessage).toContain('1-day streak active');
      expect(state.statusMessage).toContain('3 more actions needed');
    });

    it('advances current streak when today is completed', () => {
      const records: DailyActivityRecord[] = [
        {
          date: '2026-09-26',
          questionsAnswered: 5,
          correctCount: 5,
          sessionsCompleted: 1,
          qualifyingItemIds: ['q:a', 'q:b', 'q:c', 'q:d', 'q:e'],
          qualifyingCount: 5,
          goalMet: true,
        },
        {
          date: '2026-09-27',
          questionsAnswered: 5,
          correctCount: 5,
          sessionsCompleted: 1,
          qualifyingItemIds: ['q:f', 'q:g', 'q:h', 'q:i', 'q:j'],
          qualifyingCount: 5,
          goalMet: true,
        },
        {
          date: '2026-09-28', // Today completes 5 items
          questionsAnswered: 5,
          correctCount: 5,
          sessionsCompleted: 1,
          qualifyingItemIds: ['q:1', 'q:2', 'q:3', 'q:4', 'q:5'],
          qualifyingCount: 5,
          goalMet: true,
        },
      ];

      const state = computeStreakState(records, '2026-09-28');
      expect(state.currentStreak).toBe(3);
      expect(state.todayQualified).toBe(true);
      expect(state.statusMessage).toContain('3-day streak secured!');
    });

    it('breaks current streak on a missed full day and provides welcoming message', () => {
      const records: DailyActivityRecord[] = [
        {
          date: '2026-09-25',
          questionsAnswered: 5,
          correctCount: 5,
          sessionsCompleted: 1,
          qualifyingItemIds: ['q:1', 'q:2', 'q:3', 'q:4', 'q:5'],
          qualifyingCount: 5,
          goalMet: true,
        },
        {
          date: '2026-09-26',
          questionsAnswered: 5,
          correctCount: 5,
          sessionsCompleted: 1,
          qualifyingItemIds: ['q:6', 'q:7', 'q:8', 'q:9', 'q:10'],
          qualifyingCount: 5,
          goalMet: true,
        },
        // 2026-09-27 was completely missed!
        {
          date: '2026-09-28', // Today
          questionsAnswered: 1,
          correctCount: 1,
          sessionsCompleted: 0,
          qualifyingItemIds: ['q:11'],
          qualifyingCount: 1,
          goalMet: false,
        },
      ];

      const state = computeStreakState(records, '2026-09-28');
      expect(state.currentStreak).toBe(0); // Missed day resets current streak
      expect(state.bestStreak).toBe(2);    // Preserves best streak
      expect(state.statusMessage).toContain('Welcome back! Complete 5 questions or reviews today');
      expect(state.statusMessage).not.toContain('lost'); // No guilt/shame messaging
    });

    it('conservatively refuses to fabricate streak qualification from ambiguous legacy records', () => {
      // Legacy records with aggregate questionsAnswered but no qualifyingItemIds
      const records: DailyActivityRecord[] = [
        {
          date: '2026-09-27',
          questionsAnswered: 20, // Could be same question clicked 20 times or ambiguous timezone
          correctCount: 18,
          sessionsCompleted: 2,
        },
      ];

      const state = computeStreakState(records, '2026-09-28');
      // Conservative migration: ambiguous legacy record does NOT count as verified qualifying day
      expect(state.currentStreak).toBe(0);
      expect(state.qualifyingDates).toEqual([]);
    });
  });

  describe('4. Persistence & Full Backup Durability', () => {
    beforeEach(async () => {
      await clearAllLocalData();
    });

    it('persists qualifying actions in IndexedDB and retrieves them accurately', async () => {
      const today = getKarachiDayKey();
      const res1 = await dailyActivityRepo.recordQualifyingAction(
        today,
        canonicalizeQuestionId('pers-q-1')
      );
      expect(res1.wasNewAction).toBe(true);
      expect(res1.record.qualifyingCount).toBe(1);

      // Add remaining 4 items
      for (let i = 2; i <= 5; i++) {
        await dailyActivityRepo.recordQualifyingAction(
          today,
          canonicalizeQuestionId(`pers-q-${i}`)
        );
      }

      const all = await dailyActivityRepo.getAll();
      const todayRec = all.find((a) => a.date === today);
      expect(todayRec).toBeDefined();
      expect(todayRec?.qualifyingCount).toBe(5);
      expect(todayRec?.goalMet).toBe(true);
      expect(todayRec?.qualifyingItemIds).toHaveLength(5);
    });

    it('preserves all qualifying habit data through backup export and restore', async () => {
      const today = getKarachiDayKey();
      for (let i = 1; i <= 5; i++) {
        await dailyActivityRepo.recordQualifyingAction(
          today,
          canonicalizeQuestionId(`backup-test-q-${i}`)
        );
      }

      // Export backup
      const backupJson = await exportLocalBackup();
      expect(backupJson).toContain('backup-test-q-1');

      // Clear database to simulate fresh environment
      await clearAllLocalData();
      const emptyCheck = await dailyActivityRepo.getAll();
      expect(emptyCheck.find((a) => a.date === today)).toBeUndefined();

      // Restore from backup
      const importRes = await importLocalBackup(backupJson);
      expect(importRes.success).toBe(true);

      const restored = await dailyActivityRepo.getAll();
      const restoredToday = restored.find((a) => a.date === today);
      expect(restoredToday).toBeDefined();
      expect(restoredToday?.qualifyingCount).toBe(5);
      expect(restoredToday?.goalMet).toBe(true);
      expect(restoredToday?.qualifyingItemIds).toHaveLength(5);
    });
  });
});
