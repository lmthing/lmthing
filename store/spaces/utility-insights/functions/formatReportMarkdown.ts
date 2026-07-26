/**
 * Render a digest report as markdown — pure, deterministic, never throws.
 *
 * The rendering is mechanical on purpose: the same inputs always produce the exact same string, so
 * a re-run of the digest cannot quietly reword last week's report. Tables are sorted by name and
 * every figure is taken verbatim from the profile — this function computes nothing and invents
 * nothing.
 *
 * @param profile      The `profileTables` result — an array of `{ table, rowCount, columns }`, or
 *                     an object wrapping it as `{ tables: [...] }`.
 * @param highlights   Highlight lines: strings, or `{ label, detail }` objects (joined with " — ").
 * @param periodLabel  The period this report covers (e.g. `2026-W31`).
 * @returns A markdown string, or `''` when there is nothing at all to report (both the profile and
 *          the highlights are missing or unusable).
 */
export function formatReportMarkdown(profile: unknown, highlights: unknown, periodLabel: unknown): string {
  const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim().slice(0, 300);

  // Accept either the bare array or { tables: [...] }.
  const raw = Array.isArray(profile)
    ? profile
    : profile && typeof profile === 'object' && Array.isArray((profile as { tables?: unknown }).tables)
      ? ((profile as { tables: unknown[] }).tables)
      : [];

  const tables: { table: string; rowCount: number; columnCount: number }[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const name = clean((t as { table?: unknown }).table);
    if (name === '') continue;
    const rowCount = Number((t as { rowCount?: unknown }).rowCount);
    const cols = (t as { columns?: unknown }).columns;
    tables.push({
      table: name,
      rowCount: Number.isFinite(rowCount) ? rowCount : 0,
      columnCount: Array.isArray(cols) ? cols.length : 0,
    });
  }
  tables.sort((a, b) => a.table.localeCompare(b.table));

  const lines: string[] = [];
  if (Array.isArray(highlights)) {
    for (const h of highlights) {
      if (typeof h === 'string') {
        const s = clean(h);
        if (s !== '') lines.push(s);
      } else if (h && typeof h === 'object') {
        const parts = [clean((h as { label?: unknown }).label), clean((h as { detail?: unknown }).detail)].filter((p) => p !== '');
        if (parts.length > 0) lines.push(parts.join(' — '));
      }
    }
  }

  if (tables.length === 0 && lines.length === 0) return '';

  const period = clean(periodLabel) || 'unknown period';
  const out: string[] = [`# Data digest — ${period}`, ''];

  out.push('## Highlights', '');
  if (lines.length === 0) out.push('_No highlights this period._');
  else for (const l of lines) out.push(`- ${l}`);
  out.push('');

  out.push('## Tables', '');
  if (tables.length === 0) {
    out.push('_No tables were profiled._');
  } else {
    out.push('| Table | Rows sampled | Columns |', '| --- | --- | --- |');
    for (const t of tables) out.push(`| ${t.table} | ${t.rowCount} | ${t.columnCount} |`);
  }

  return out.join('\n');
}
