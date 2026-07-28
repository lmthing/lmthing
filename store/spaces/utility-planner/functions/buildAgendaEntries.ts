/**
 * Turn bindings + their tables' rows into flat agenda entries — pure, deterministic via `fromIso`.
 *
 * The window is CALENDAR DAYS in UTC and half-open: `[fromDay, fromDay + days)`. A date column means
 * a day, not an instant, so a midday call still shows everything happening today, and the day
 * `days` later is excluded (14 days from Monday covers Monday through the second Sunday). Rows whose
 * bound column is empty or unparseable are skipped, never guessed; rows without an `id` are skipped
 * too — an entry nobody can navigate back to is not useful.
 *
 * Self-contained: the local `parse` mirrors a lenient ISO/epoch date parser (sibling space functions
 * cannot call each other — they are injected standalone).
 *
 * @param bindings    Active binding rows: `{ targetTable, targetColumn, labelColumn?, kind? }[]`.
 * @param rowsByTable `{ [tableName]: rows[] }` — the rows already loaded per bound table.
 * @param fromIso     Start of the window as an ISO string — inject it; never read the clock here.
 * @param days        Window length in calendar days (defaults to 14 when missing or not positive).
 * @returns `{ date: 'YYYY-MM-DD', table, rowId, label, kind }[]` sorted by date, then table, then
 *          rowId. Degrades to `[]`.
 */
export function buildAgendaEntries(
  bindings: unknown,
  rowsByTable: Record<string, Record<string, unknown>[]> | null | undefined,
  fromIso: string,
  days: number,
): { date: string; table: string; rowId: string; label: string; kind: string }[] {
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

  const fromT = Date.parse(fromIso ?? '');
  if (Number.isNaN(fromT) || !Array.isArray(bindings)) return [];

  const DAY = 86_400_000;
  const span = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14;
  const fromDay = Math.floor(fromT / DAY);
  const windowStart = fromDay * DAY;
  const windowEnd = (fromDay + span) * DAY; // exclusive

  const out: { date: string; table: string; rowId: string; label: string; kind: string }[] = [];
  for (const b of bindings) {
    if (!b || typeof b !== 'object') continue;
    const table = (b as { targetTable?: unknown }).targetTable;
    const column = (b as { targetColumn?: unknown }).targetColumn;
    if (typeof table !== 'string' || table === '' || typeof column !== 'string' || column === '') continue;
    const labelColumn = (b as { labelColumn?: unknown }).labelColumn;
    const rawKind = (b as { kind?: unknown }).kind;
    const kind = typeof rawKind === 'string' && rawKind !== '' ? rawKind : 'event';

    const rows = Array.isArray(rowsByTable?.[table]) ? rowsByTable![table] : [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const at = parse(row[column]);
      if (at === null) continue;
      const t = Date.parse(at);
      if (t < windowStart || t >= windowEnd) continue;
      const rawId = row['id'];
      const rowId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
      if (rowId === '') continue; // a row we cannot re-identify cannot be listed
      const labelSource =
        (typeof labelColumn === 'string' && labelColumn !== '' ? row[labelColumn] : undefined) ??
        row['name'] ?? row['title'] ?? row['label'] ?? rowId;
      out.push({ date: at.slice(0, 10), table, rowId, label: String(labelSource).slice(0, 200), kind });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.table.localeCompare(b.table) || a.rowId.localeCompare(b.rowId));
  return out;
}
