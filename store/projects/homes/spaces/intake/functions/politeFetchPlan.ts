/**
 * Turn a set of opted-in `saved_search` sources into a throttled, polite fetch
 * plan the `poll` action follows. Enforces the app's politeness invariants
 * deterministically (spec §polling opt-in & self-limiting):
 *   - only sources with `pollEnabled`, a `url`, and no `blockedReason`;
 *   - `pollIntervalHours` FLOORS at 6 — a source configured lower is treated as 6;
 *   - a source is "due" only if `now − lastPolledAt ≥ interval`;
 *   - per-HOST minimum spacing + jitter so we never hammer one portal;
 *   - a hard per-run page cap across the whole plan.
 *
 * Pure function of its inputs (no clock reads inside) — `now` is passed in so it's
 * testable. See `listing-parsing/polling-and-politeness`.
 */
export interface PollableSource {
  id: string;
  url?: string;
  pollEnabled?: boolean;
  pollIntervalHours?: number;
  lastPolledAt?: string | null;
  blockedReason?: string | null;
  /** A one-off "Check now" request; a pending one (after lastPolledAt) is polled once
   *  regardless of pollEnabled/interval — the user's explicit consent for this fetch. */
  pollRequestedAt?: string | null;
}

export interface FetchPlanEntry {
  sourceId: string;
  url: string;
  host: string;
  earliestAtMs: number; // don't fetch before this (per-host spacing + jitter)
  maxPages: number;
}

const MIN_INTERVAL_HOURS = 6;
const PER_HOST_SPACING_MS = 20_000; // ≥20s between two fetches to the same host
const HARD_PAGE_CAP = 12; // across the whole run
const PER_SOURCE_PAGES = 3;

export function politeFetchPlan(
  sources: PollableSource[],
  now: number,
  opts?: { jitterMs?: number },
): FetchPlanEntry[] {
  const jitter = opts?.jitterMs ?? 5_000;
  const due = (sources ?? []).filter((s) => {
    if (!s.url || s.blockedReason) return false;
    const lastMs = s.lastPolledAt ? Date.parse(s.lastPolledAt) : NaN;
    // A pending one-off "Check now" (pollRequestedAt after the last poll) is always due —
    // explicit user consent bypasses the recurring opt-in and the interval, but NOT robots
    // (the clipper still robots-checks each host) or the per-host spacing/page caps below.
    if (s.pollRequestedAt) {
      const reqMs = Date.parse(s.pollRequestedAt);
      if (Number.isFinite(reqMs) && (!Number.isFinite(lastMs) || reqMs > lastMs)) return true;
    }
    if (!s.pollEnabled) return false;
    const interval = Math.max(MIN_INTERVAL_HOURS, s.pollIntervalHours ?? 12) * 3_600_000;
    if (!s.lastPolledAt) return true;
    return !Number.isFinite(lastMs) || now - lastMs >= interval;
  });

  const lastHostAt = new Map<string, number>();
  const plan: FetchPlanEntry[] = [];
  let pagesUsed = 0;

  for (const s of due) {
    if (pagesUsed >= HARD_PAGE_CAP) break;
    const host = hostOf(s.url!);
    const prev = lastHostAt.get(host) ?? now;
    const earliest = Math.max(now, prev) + (lastHostAt.has(host) ? PER_HOST_SPACING_MS : 0) + Math.floor(Math.random() * jitter);
    const maxPages = Math.min(PER_SOURCE_PAGES, HARD_PAGE_CAP - pagesUsed);
    plan.push({ sourceId: s.id, url: s.url!, host, earliestAtMs: earliest, maxPages });
    lastHostAt.set(host, earliest);
    pagesUsed += maxPages;
  }

  return plan;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
