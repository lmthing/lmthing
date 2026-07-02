/**
 * Pure helpers for the budget endpoint. Budget windows are rolling spend caps
 * (1d / 7d / 30d) enforced by LiteLLM on the user's key, but LiteLLM does not
 * expose per-window spend — so we compute it from daily-activity spend, anchoring
 * each window to the user's first day (`created_at`) rather than LiteLLM's
 * calendar-aligned `reset_at`. Computed in the gateway with the master key, which
 * bypasses the per-key budget gate (an over-budget key 429s even on reads).
 */

export const DAY_MS = 86_400_000;

/** Friendly labels for the standard windows; falls back to the raw duration. */
export const WINDOW_LABELS: Record<string, string> = {
  "1d": "Today",
  "7d": "Week",
  "30d": "Month",
};

/** Parse a LiteLLM budget_duration into whole days. `Nd` → N; a legacy `Nh`
 *  (un-migrated tier) rounds up to at least one day so it still renders. */
export function parseDurationDays(duration: string): number | null {
  let m = /^(\d+)d$/.exec(duration);
  if (m) return parseInt(m[1]!, 10);
  m = /^(\d+)h$/.exec(duration);
  if (m) return Math.max(1, Math.ceil(parseInt(m[1]!, 10) / 24));
  return null;
}

/** UTC midnight (epoch ms) of the day containing `ms`. */
export function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `YYYY-MM-DD` (UTC) for the day containing `ms`. */
export function isoDate(ms: number): string {
  return new Date(utcDayStart(ms)).toISOString().slice(0, 10);
}

/**
 * Current window boundaries for an `nDays` window, anchored to `createdAtMs`.
 * The window repeats every `nDays` from the created day; returns the current
 * period's `start` (inclusive, UTC midnight) and `reset` (start + nDays).
 */
export function windowBounds(
  createdAtMs: number,
  nowMs: number,
  nDays: number,
): { start: number; reset: number } {
  const d0 = utcDayStart(createdAtMs);
  const today = utcDayStart(nowMs);
  const daysSince = Math.max(0, Math.floor((today - d0) / DAY_MS));
  const periods = Math.floor(daysSince / nDays);
  const start = d0 + periods * nDays * DAY_MS;
  return { start, reset: start + nDays * DAY_MS };
}

/** Sum a `date → spend` map over the inclusive UTC day range [startMs, nowMs]. */
export function sumSpend(
  dailyByDate: Map<string, number>,
  startMs: number,
  nowMs: number,
): number {
  const today = utcDayStart(nowMs);
  let total = 0;
  for (let d = utcDayStart(startMs); d <= today; d += DAY_MS) {
    total += dailyByDate.get(isoDate(d)) ?? 0;
  }
  return total;
}

/** Percentage of a window's cap still available (0–100), or `null` for an
 *  invalid cap. Clamped so over-spend reads as 0, not negative. */
export function remainingPct(maxBudget: number, spend: number): number | null {
  if (!(maxBudget > 0)) return null;
  return Math.max(0, Math.min(1, (maxBudget - spend) / maxBudget)) * 100;
}
