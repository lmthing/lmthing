/**
 * Canonicalize ONE cell value, conservatively — pure, never throws.
 *
 * The rule that governs every branch: **never "fix" what it cannot prove**. If the value does not
 * clearly belong to the requested kind (an email that isn't email-shaped, a phone with an
 * implausible digit count, an unparseable date), the answer is `{ changed: false, value }` with the
 * original returned untouched. A proposal the janitor cannot justify is worse than no proposal.
 *
 * Kinds:
 *  - `whitespace` — trim + collapse internal runs of whitespace to a single space.
 *  - `email`      — trim + lowercase, ONLY when the trimmed value matches a valid email shape.
 *  - `phone`      — strip spaces, dashes, dots and parentheses (a leading `+` is preserved), ONLY
 *                   when the remaining digit count is 7–15 (ITU E.164 plausibility).
 *  - `date`       — canonicalize to `YYYY-MM-DD` using the same lenient date shapes the deadlines
 *                   parser accepts (ISO date/datetime, `YYYY/MM/DD`, epoch seconds/milliseconds).
 *
 * Self-contained by design: space functions are injected standalone, so the date parser is
 * duplicated inline rather than imported.
 *
 * @param kind   `'whitespace' | 'email' | 'phone' | 'date'` — anything else is a no-op.
 * @param value  The raw cell value.
 * @returns `{ changed, value }` — `changed` is true only when a normalized value differs from the
 *          original. Non-string values (numbers, null, objects) never change except for `date`,
 *          which accepts epoch numbers.
 */
export function normalizeCellValue(
  kind: string,
  value: unknown,
): { changed: boolean; value: unknown } {
  const parseDate = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return null;
      if (v >= 1e11 && v < 1e14) return new Date(v).toISOString();
      if (v >= 1e8 && v < 1e11) return new Date(v * 1000).toISOString();
      return null;
    }
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (s === '') return null;
    if (/^\d+$/.test(s)) return parseDate(Number(s));
    const dateShape = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!dateShape.test(s)) return null;
    const normalized = s.replace(/\//g, '-').replace(' ', 'T');
    const t = Date.parse(normalized.includes('T') || normalized.includes('Z') ? normalized : `${normalized}T00:00:00Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };

  const unchanged = { changed: false, value };

  if (kind === 'date') {
    const iso = parseDate(value);
    if (iso === null) return unchanged;
    const day = iso.slice(0, 10);
    return day === value ? unchanged : { changed: true, value: day };
  }

  if (typeof value !== 'string') return unchanged;

  if (kind === 'whitespace') {
    const next = value.trim().replace(/\s+/g, ' ');
    return next === value ? unchanged : { changed: true, value: next };
  }

  if (kind === 'email') {
    const trimmed = value.trim();
    // Deliberately strict-ish: one @, no whitespace, a dotted TLD of >= 2 letters.
    const emailShape = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
    if (!emailShape.test(trimmed)) return unchanged;
    const next = trimmed.toLowerCase();
    return next === value ? unchanged : { changed: true, value: next };
  }

  if (kind === 'phone') {
    const trimmed = value.trim();
    const plus = trimmed.startsWith('+');
    const stripped = trimmed.replace(/[\s.\-()]/g, '');
    const body = plus ? stripped.slice(1) : stripped;
    if (!/^\d+$/.test(body)) return unchanged; // letters, extensions, prose → cannot prove it
    if (body.length < 7 || body.length > 15) return unchanged;
    const next = plus ? `+${body}` : body;
    return next === value ? unchanged : { changed: true, value: next };
  }

  return unchanged;
}
