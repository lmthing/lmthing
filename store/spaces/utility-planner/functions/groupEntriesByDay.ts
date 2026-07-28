/**
 * Group flat agenda entries into days — pure, never throws, order-preserving.
 *
 * The grouping adds no opinion: days appear in the order their first entry appears, and entries stay
 * in the order they arrived. Fed the (already sorted) output of `buildAgendaEntries`, that means
 * chronological days each holding table/rowId-sorted entries. Days with no entries are simply
 * absent — an agenda never pads itself with empty dates.
 *
 * @param entries  `{ date, table, rowId, label, kind }[]` — entries without a usable `date` string
 *                 are dropped.
 * @returns `{ days: { date, entries }[] }`. Degrades to `{ days: [] }`.
 */
export function groupEntriesByDay(
  entries: unknown,
): { days: { date: string; entries: Record<string, unknown>[] }[] } {
  if (!Array.isArray(entries)) return { days: [] };

  const days: { date: string; entries: Record<string, unknown>[] }[] = [];
  const index: Record<string, number> = {};

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const date = (e as { date?: unknown }).date;
    if (typeof date !== 'string' || date === '') continue;
    const at = index[date];
    if (at === undefined) {
      index[date] = days.length;
      days.push({ date, entries: [e as Record<string, unknown>] });
    } else {
      days[at].entries.push(e as Record<string, unknown>);
    }
  }
  return { days };
}
