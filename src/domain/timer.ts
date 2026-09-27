/**
 * Deadline-Based Timer Logic for WardWit
 * 
 * Timers use absolute timestamp deadlines (startedAt + durationMs),
 * ensuring countdowns do not reset on page refresh or drift during interval ticks.
 */

export function computeDeadline(startedAt: number, durationMinutes: number): number {
  return startedAt + durationMinutes * 60 * 1000;
}

export function getRemainingSeconds(expiresAt: number, now = Date.now()): number {
  const diffMs = expiresAt - now;
  return Math.max(0, Math.floor(diffMs / 1000));
}

export function isTimerExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

export function formatRemainingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${pad(hours)}:${pad(remMins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
