/**
 * Window math for one watcher over one table's rows — pure, deterministic via injected `now`.
 *
 * A row is "due" when its watched column parses to a timestamp inside
 * `[now - graceDays, now + leadDays]` (end-of-day inclusive). The small backward grace window
 * (default 1 day) keeps a just-missed deadline visible for one sweep instead of dropping it
 * silently. Rows whose column is empty or unparseable are skipped, never guessed.
 *
 * Self-contained: the local `parse` mirrors `parseDateValue` (sibling space functions cannot call
 * each other — they are injected standalone).
 *
 * @param rows        The table's rows (as from `db.query(table)`).
 * @param column      The watched column name.
 * @param leadDays    Look-ahead window in days (e.g. 14).
 * @param nowIso      The reference instant as an ISO string — inject it; never read the clock here.
 * @param labelColumn Optional column used as the human label (falls back to name/title/label/id).
 * @param graceDays   Backward window in days (default 1).
 * @returns `{ rowId, dueAt, daysLeft, label }[]` sorted by dueAt asc. `daysLeft` is calendar days,
 *          can be 0 (due today) or -1 (inside the grace window).
 */
export function computeDueItems(
  rows: Record<string, unknown>[] | null | undefined,
  column: string,
  leadDays: number,
  nowIso: string,
  labelColumn?: string | null,
  graceDays = 1,
): { rowId: string; dueAt: string; daysLeft: number; label: string }[] {
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
  if (Number.isNaN(nowT) || !Array.isArray(rows) || typeof column !== 'string' || column === '') return [];
  const lead = Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : 14;
  const grace = Number.isFinite(graceDays) && graceDays >= 0 ? graceDays : 1;
  const DAY = 86_400_000;
  // Calendar-day semantics (UTC): date columns mean days, not instants. The window spans from the
  // START of the day `grace` days back to the END of the day `lead` days ahead, and `daysLeft` is
  // the calendar-day difference — so a midday sweep still sees all of "yesterday" and "today".
  const nowDay = Math.floor(nowT / DAY);
  const windowStart = (nowDay - grace) * DAY;
  const windowEnd = (nowDay + lead) * DAY + (DAY - 1);

  const out: { rowId: string; dueAt: string; daysLeft: number; label: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const dueAt = parse(row[column]);
    if (dueAt === null) continue;
    const dueT = Date.parse(dueAt);
    if (dueT < windowStart || dueT > windowEnd) continue;
    const rawId = row['id'];
    const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
    if (rowId === '') continue; // a row we cannot re-identify cannot be alerted on
    const labelSource =
      (labelColumn && row[labelColumn]) ?? row['name'] ?? row['title'] ?? row['label'] ?? rowId;
    const label = String(labelSource).slice(0, 200);
    const daysLeft = Math.floor(dueT / DAY) - nowDay;
    out.push({ rowId, dueAt, daysLeft, label });
  }
  out.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.rowId.localeCompare(b.rowId));
  return out;
}
