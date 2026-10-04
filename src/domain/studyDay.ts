/**
 * Study Day & Timezone Utilities for WardWit
 *
 * All daily goals, streaks, and study plans are based on Asia/Karachi (UTC+5).
 * Timestamps are stored as epoch millisecond instants; day keys are derived consistently.
 */

export const KARACHI_TIMEZONE = 'Asia/Karachi';

/**
 * Returns the study day key (YYYY-MM-DD) for a given instant in Asia/Karachi timezone.
 *
 * @param timestamp Epoch milliseconds or Date object (defaults to Date.now())
 */
export function getKarachiDayKey(timestamp: number | Date = Date.now()): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  // Intl.DateTimeFormat with 'en-CA' outputs ISO-like 'YYYY-MM-DD'
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KARACHI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Deterministically returns the calendar day immediately preceding the given YYYY-MM-DD.
 */
export function getPreviousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const prevDate = new Date(Date.UTC(y, m - 1, d - 1));
  const py = prevDate.getUTCFullYear();
  const pm = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(prevDate.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

/**
 * Deterministically returns the calendar day immediately following the given YYYY-MM-DD.
 */
export function getNextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = nextDate.getUTCFullYear();
  const nm = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(nextDate.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Calculates the number of milliseconds remaining until 00:00:00.000 (midnight)
 * of the next day in Asia/Karachi.
 */
export function getMsUntilNextKarachiMidnight(nowMs: number = Date.now()): number {
  const currentKey = getKarachiDayKey(nowMs);
  const nextKey = getNextDayKey(currentKey);
  const [ny, nm, nd] = nextKey.split('-').map(Number);

  // Karachi is UTC+5 without Daylight Saving Time.
  // Midnight in Karachi corresponds to (Midnight UTC - 5 hours) on that calendar date.
  // 00:00:00 PKT = 19:00:00 UTC on the previous UTC day.
  const nextMidnightUtcMs = Date.UTC(ny, nm - 1, nd, 0, 0, 0, 0) - (5 * 60 * 60 * 1000);
  const diff = nextMidnightUtcMs - nowMs;
  return diff > 0 ? diff : 1000; // minimum 1s safety
}

export interface WeekDayInfo {
  dateKey: string;
  dayLabel: string; // 'M', 'T', 'W', 'T', 'F', 'S', 'S'
  dayName: string;  // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  dayNumber: string; // '28'
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

/**
 * Generates the 7 days (Monday through Sunday) of the week containing the given active day key.
 */
export function getKarachiWeekDays(activeDayKey: string, todayKey = getKarachiDayKey()): WeekDayInfo[] {
  const [y, m, d] = activeDayKey.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfWeek = dateObj.getUTCDay();
  // We want Monday as index 0 (0=Mon, 1=Tue, ..., 6=Sun)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekDays: WeekDayInfo[] = [];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const offset = mondayOffset + i;
    const targetDate = new Date(Date.UTC(y, m - 1, d + offset));
    const ty = targetDate.getUTCFullYear();
    const tm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const td = String(targetDate.getUTCDate()).padStart(2, '0');
    const dateKey = `${ty}-${tm}-${td}`;

    weekDays.push({
      dateKey,
      dayLabel: dayLabels[i],
      dayName: dayNames[i],
      dayNumber: String(targetDate.getUTCDate()),
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      isFuture: dateKey > todayKey,
    });
  }

  return weekDays;
}
