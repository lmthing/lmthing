/**
 * Gate one researched value before it is ever proposed — pure, never throws.
 *
 * This is the only thing standing between a model's paraphrase and the user's database, so it runs
 * twice: once when the value is proposed, once again immediately before it is applied (the row may
 * have been approved days earlier).
 *
 * `hint` is `'number' | 'date' | 'url' | 'text'`. When it is absent or empty the hint is INFERRED
 * from the column name, in this order:
 *   `price|cost|amount|count|year` → number · `date|_at|_on` → date · `url|link|website` → url ·
 *   otherwise text.
 *
 * Per-hint rules:
 *  - **number** — locale-tolerant: the LAST separator decides the decimal point, so `1,234.50` and
 *    `1.234,50` both read as 1234.5, while a single separator followed by EXACTLY three digits is
 *    a thousands group (`1,234` → 1234). Currency symbols and spaces are stripped. Normalizes to a
 *    JS number.
 *  - **date** — the same lenient shapes the rest of the catalog accepts (ISO date/datetime,
 *    `YYYY/MM/DD`, epoch seconds/ms); normalizes to `YYYY-MM-DD`.
 *  - **url** — must be an `http(s)://host.tld…` shape with no whitespace; normalizes to the
 *    trimmed string. A bare domain is rejected: a citation you cannot open is not a citation.
 *  - **text** — non-empty, at most 500 characters, runs of more than two newlines collapsed to a
 *    blank line. An essay is not a cell value.
 *
 * @returns `{ ok, normalized, reason }` — `normalized` is `null` whenever `ok` is false, and
 *          `reason` is `''` whenever `ok` is true.
 */
export function validateProposedValue(
  column: unknown,
  value: unknown,
  hint?: unknown,
): { ok: boolean; normalized: string | number | null; reason: string } {
  const fail = (reason: string) => ({ ok: false, normalized: null, reason });

  const col = typeof column === 'string' ? column : '';
  const rawHint = typeof hint === 'string' ? hint.trim().toLowerCase() : '';
  const inferred = /(price|cost|amount|count|year)/i.test(col)
    ? 'number'
    : /(date|_at|_on)/i.test(col)
      ? 'date'
      : /(url|link|website)/i.test(col)
        ? 'url'
        : 'text';
  const kind = ['number', 'date', 'url', 'text'].includes(rawHint) ? rawHint : inferred;

  if (value === null || value === undefined) return fail('empty value');
  if (typeof value === 'object') return fail('value must be a scalar, not an object');
  const text = String(value).trim();
  if (text === '') return fail('empty value');

  if (kind === 'number') {
    const s = text.replace(/\s/g, '').replace(/[^0-9.,+-]/g, '');
    if (s === '' || !/[0-9]/.test(s)) return fail('not a number');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized = s;
    if (lastComma >= 0 && lastDot >= 0) {
      // Both present: the LAST one is the decimal point, the other groups thousands.
      normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (lastComma >= 0 || lastDot >= 0) {
      // Exactly one separator kind. A single separator followed by EXACTLY three digits is a
      // thousands group ("1,234" and "1.234" are both 1234 in published data); anything else is a
      // decimal point ("12.5", "1,23"). Two or more groups ("1.234.567") are always thousands.
      const sep = lastComma >= 0 ? ',' : '.';
      const groups = s.split(sep);
      const isThousands = groups.length > 2 || /^\d{3}$/.test(groups[groups.length - 1] ?? '');
      normalized = isThousands ? groups.join('') : s.replace(sep === ',' ? /,/g : /\./g, '.');
    }
    const n = Number(normalized);
    if (!Number.isFinite(n)) return fail('not a number');
    return { ok: true, normalized: n, reason: '' };
  }

  if (kind === 'date') {
    if (/^\d+$/.test(text)) {
      const n = Number(text);
      if (n >= 1e11 && n < 1e14) return { ok: true, normalized: new Date(n).toISOString().slice(0, 10), reason: '' };
      if (n >= 1e8 && n < 1e11) return { ok: true, normalized: new Date(n * 1000).toISOString().slice(0, 10), reason: '' };
      return fail('not a date');
    }
    const shape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!shape.test(text)) return fail('not a date');
    const norm = text.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(norm.includes('T') || norm.includes('Z') ? norm : `${norm}T00:00:00Z`);
    if (Number.isNaN(t)) return fail('not a date');
    return { ok: true, normalized: new Date(t).toISOString().slice(0, 10), reason: '' };
  }

  if (kind === 'url') {
    if (/\s/.test(text)) return fail('not an http(s) url');
    if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+[^\s]*$/i.test(text)) return fail('not an http(s) url');
    return { ok: true, normalized: text, reason: '' };
  }

  // text
  const collapsed = text.replace(/\n{3,}/g, '\n\n');
  if (collapsed.length > 500) return fail('too long (max 500 characters)');
  return { ok: true, normalized: collapsed, reason: '' };
}
