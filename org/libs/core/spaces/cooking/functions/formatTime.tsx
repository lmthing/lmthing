/**
 * Format a duration in minutes to a human-readable string.
 * @param minutes Total time in minutes
 */

export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
