import { describe, it, expect } from 'vitest';
import {
  computeDeadline,
  getRemainingSeconds,
  isTimerExpired,
  formatRemainingTime,
} from '../domain/timer';

describe('Deadline-Based Timer', () => {
  it('computes exact timestamp deadline', () => {
    const startedAt = 1000000;
    const durationMinutes = 15;
    const deadline = computeDeadline(startedAt, durationMinutes);
    expect(deadline).toBe(1000000 + 15 * 60 * 1000);
  });

  it('calculates remaining seconds and handles expiration', () => {
    const deadline = 50000;

    // 20 seconds before deadline
    expect(getRemainingSeconds(deadline, 30000)).toBe(20);
    expect(isTimerExpired(deadline, 30000)).toBe(false);

    // Exactly at deadline
    expect(getRemainingSeconds(deadline, 50000)).toBe(0);
    expect(isTimerExpired(deadline, 50000)).toBe(true);

    // Past deadline (does not return negative numbers)
    expect(getRemainingSeconds(deadline, 65000)).toBe(0);
    expect(isTimerExpired(deadline, 65000)).toBe(true);
  });

  it('formats remaining seconds cleanly', () => {
    expect(formatRemainingTime(0)).toBe('00:00');
    expect(formatRemainingTime(59)).toBe('00:59');
    expect(formatRemainingTime(65)).toBe('01:05');
    expect(formatRemainingTime(600)).toBe('10:00');
    expect(formatRemainingTime(3665)).toBe('01:01:05');
  });
});
