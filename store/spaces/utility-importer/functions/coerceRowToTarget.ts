/**
 * Project one source row onto the target's columns and type-check it — pure, never throws.
 *
 * A value that fails its hint is NOT written and NOT guessed: the target column is omitted and the
 * problem is reported in `issues`, so a dry-run can show exactly which cells would be lost and why.
 * Silent coercion is how an import quietly turns "1.234,50" into 1.234.
 *
 * Number parsing is locale-tolerant: the LAST separator decides the decimal point, so both
 * `1,234.50` and `1.234,50` read as 1234.5, while `1,234` (no decimal marker) reads as 1234.
 *
 * @param columnHints `{ [targetColumn]: 'string'|'number'|'boolean'|'date' }` — optional; an
 *                    unhinted column is taken as text.
 */
export function coerceRowToTarget(
  row: Record<string, unknown> | null | undefined,
  mapping: { source: string; target: string | null }[] | null | undefined,
  columnHints?: Record<string, string> | null,
): { ok: boolean; row: Record<string, unknown>; issues: { target: string; value: string; problem: string }[] } {
  const out: Record<string, unknown> = {};
  const issues: { target: string; value: string; problem: string }[] = [];
  if (!row || typeof row !== 'object' || !Array.isArray(mapping)) return { ok: true, row: out, issues };

  const hints = columnHints && typeof columnHints === 'object' ? columnHints : {};

  const toNumber = (raw: string): number | null => {
    const s = raw.replace(/\s/g, '').replace(/[^0-9.,+-]/g, '');
    if (s === '' || !/[0-9]/.test(s)) return null;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized = s;
    if (lastComma >= 0 && lastDot >= 0) {
      // Both present: the LAST one is the decimal point, the other groups thousands.
      if (lastComma > lastDot) normalized = s.replace(/\./g, '').replace(',', '.');
      else normalized = s.replace(/,/g, '');
    } else if (lastComma >= 0 || lastDot >= 0) {
      // Exactly one separator kind. A single separator followed by EXACTLY three digits is a
      // thousands group ("1,234" and "1.234" are both 1234 in export data); anything else is a
      // decimal point ("12.5", "1,23"). Two or more groups ("1.234.567") are always thousands.
      const sep = lastComma >= 0 ? ',' : '.';
      const groups = s.split(sep);
      const isThousands = groups.length > 2 || /^\d{3}$/.test(groups[groups.length - 1] ?? '');
      normalized = isThousands
        ? s.split(sep).join('')
        : s.replace(sep === ',' ? /,/g : /\./g, '.');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const toDate = (raw: string): string | null => {
    const s = raw.trim();
    if (s === '') return null;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (n >= 1e11 && n < 1e14) return new Date(n).toISOString().slice(0, 10);
      if (n >= 1e8 && n < 1e11) return new Date(n * 1000).toISOString().slice(0, 10);
      return null;
    }
    if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) return null;
    const normalized = s.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  };

  for (const pair of mapping) {
    if (!pair || typeof pair !== 'object' || !pair.target) continue; // unmapped source: intentionally dropped
    const raw = row[pair.source];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue; // empty cell: leave the column unset

    const value = String(raw).trim();
    const hint = String(hints[pair.target] ?? 'string');

    if (hint === 'number') {
      const n = toNumber(value);
      if (n === null) { issues.push({ target: pair.target, value, problem: 'not a number' }); continue; }
      out[pair.target] = n;
    } else if (hint === 'boolean') {
      const v = value.toLowerCase();
      if (['true', 'yes', 'y', '1'].includes(v)) out[pair.target] = true;
      else if (['false', 'no', 'n', '0'].includes(v)) out[pair.target] = false;
      else { issues.push({ target: pair.target, value, problem: 'not a boolean' }); continue; }
    } else if (hint === 'date') {
      const d = toDate(value);
      if (d === null) { issues.push({ target: pair.target, value, problem: 'not a date' }); continue; }
      out[pair.target] = d;
    } else {
      out[pair.target] = value;
    }
  }

  return { ok: issues.length === 0, row: out, issues };
}
