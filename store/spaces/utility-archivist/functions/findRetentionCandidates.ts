/**
 * Name the rows old enough to archive — pure, deterministic via injected `now`, never throws.
 *
 * A row is a candidate when its `dateColumn` parses to a day STRICTLY older than
 * `now - keepDays` (calendar days, UTC). Strictly: a row landing exactly on the boundary is NOT a
 * candidate — "keep 90 days" means the 90th day is still kept. Off-by-one here would mean naming
 * data for archival a day before the user's own policy allows it.
 *
 * Nothing is deleted, moved or modified: this returns a LIST. Rows without a usable `id`, and rows
 * whose date does not parse, are skipped — never treated as infinitely old.
 *
 * Self-contained: the local `parse` mirrors the catalog's lenient date parser (space functions are
 * injected standalone, so sibling functions cannot call each other).
 *
 * @param rows       The table's rows (as from `db.query(table)`).
 * @param dateColumn The policy's retention column.
 * @param keepDays   How many days of data to keep (must be a finite number >= 0).
 * @param nowIso     The reference instant as an ISO string — inject it; never read the clock here.
 * @returns `{ rowId, ageDays }[]` sorted oldest first. Malformed input degrades to `[]`.
 */
export function findRetentionCandidates(
  rows: Record<string, unknown>[] | null | undefined,
  dateColumn: string,
  keepDays: number,
  nowIso: string,
): { rowId: string; ageDays: number }[] {
  const parse = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      if (value >= 1e11 && value < 1e14) return new Date(value).toISOString();
      if (value >= 1e8 && value < 1e11) return new Date(value * 1000).toISOString();
      return null;
    }
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (s === '') return null;
    if (/^\d+$/.test(s)) return parse(Number(s));
    const dateShape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!dateShape.test(s)) return null;
    const normalized = s.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };

  const nowT = Date.parse(nowIso ?? '');
  if (Number.isNaN(nowT) || !Array.isArray(rows)) return [];
  if (typeof dateColumn !== 'string' || dateColumn.trim() === '') return [];
  if (!Number.isFinite(keepDays) || keepDays < 0) return [];

  const DAY = 86_400_000;
  const nowDay = Math.floor(nowT / DAY);
  const cutoffDay = nowDay - Math.floor(keepDays);

  const out: { rowId: string; ageDays: number }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const iso = parse((row as Record<string, unknown>)[dateColumn]);
    if (iso === null) continue; // an unparseable date is unknown age, never "old enough"
    const rawId = (row as Record<string, unknown>)['id'];
    const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : '';
    if (rowId === '') continue; // a row we cannot name is a row we cannot report
    const rowDay = Math.floor(Date.parse(iso) / DAY);
    if (rowDay >= cutoffDay) continue; // strictly older than the cutoff, boundary day is kept
    out.push({ rowId, ageDays: nowDay - rowDay });
  }
  out.sort((a, b) => b.ageDays - a.ageDays || a.rowId.localeCompare(b.rowId));
  return out;
}
