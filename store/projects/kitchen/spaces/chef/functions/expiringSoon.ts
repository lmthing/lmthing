export interface PantryRow {
  id: string;
  name: string;
  quantity: number;
  expiresAt?: string | null;
}

/**
 * Filters pantry rows down to the ones expiring within `horizonDays` from now — the waste-reduction
 * signal `suggest-uses` fans out over to propose a use-it-up recipe for each. An ingredient with no
 * `expiresAt` (most staples — flour, oil, spices) never counts as "expiring"; one already at zero
 * quantity is excluded too, since there's nothing left to use up.
 *
 * Results are sorted soonest-expiring first (FIFO order) so callers that only act on the most
 * urgent few items can simply take the front of the array rather than re-sorting themselves.
 *
 * Deterministic given `now` — pass a fixed `now` in tests to avoid relying on the wall clock.
 *
 * @param pantry - pantry rows (`db.query('ingredients')`), each with `expiresAt` (ISO string or
 *   null/undefined) and `quantity`.
 * @param horizonDays - how many days out counts as "soon" (e.g. `3`).
 * @param now - reference time in epoch ms; defaults to `Date.now()`.
 * @returns the subset of `pantry` expiring at or before `now + horizonDays`, with `quantity > 0`,
 *   sorted by `expiresAt` ascending (soonest first).
 */
export function expiringSoon<T extends PantryRow>(pantry: T[], horizonDays: number, now: number = Date.now()): T[] {
  const cutoff = now + horizonDays * 24 * 60 * 60 * 1000;
  return pantry
    .filter((item) => item.expiresAt && item.quantity > 0 && new Date(item.expiresAt).getTime() <= cutoff)
    .sort((a, b) => new Date(a.expiresAt as string).getTime() - new Date(b.expiresAt as string).getTime());
}
