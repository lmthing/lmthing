/**
 * Evaluate ONE rule against ONE row — pure, no I/O, never throws.
 *
 * Three possible answers:
 *  - `{ ok: true }`                  — the row satisfies the rule.
 *  - `{ ok: false, reason }`         — a violation, with a human-readable reason.
 *  - `{ ok: true, skipped: '<why>' }` — the rule could not be evaluated here. **A rule that cannot
 *    be run must never manufacture a violation** — that is the contract that makes a daily sweep
 *    safe to trust.
 *
 * Kinds and their `config`:
 *  - `required`  — `{}`. The value must be present and non-empty.
 *  - `range`     — `{ min?, max? }`. A missing bound is unbounded. A non-empty, non-numeric value
 *                  IS a violation (a range column holding "n/a" is exactly the problem to catch).
 *  - `regex`     — `{ pattern, flags? }`. An INVALID pattern yields `{ ok: true, skipped:
 *                  'invalid-pattern' }` — an unrunnable rule never fails a row.
 *  - `enum`      — `{ values: [...] }`. The value must be one of them (string-compared).
 *  - `reference` — `{ table }`. A non-empty value must appear in `refIds`, which the CALLER loads;
 *                  this function performs no I/O.
 *
 * Presence is `required`'s job alone: for every other kind an empty/absent value is skipped
 * (`skipped: 'empty'`), so one blank cell produces one violation, not five.
 *
 * @param rule   `{ column, kind, config }`.
 * @param row    The row under test (`null`/`undefined` → `skipped: 'no-row'`).
 * @param refIds Ids of the referenced table — only used by `reference`.
 * @returns `{ ok, reason?, skipped? }`.
 */
export function checkRule(
  rule: { column?: string; kind?: string; config?: Record<string, unknown> } | null | undefined,
  row: Record<string, unknown> | null | undefined,
  refIds?: (string | number)[] | null,
): { ok: boolean; reason?: string; skipped?: string } {
  if (!rule || typeof rule !== 'object') return { ok: true, skipped: 'no-rule' };
  const column = typeof rule.column === 'string' ? rule.column : '';
  const kind = typeof rule.kind === 'string' ? rule.kind : '';
  if (column === '' || kind === '') return { ok: true, skipped: 'no-rule' };
  if (!row || typeof row !== 'object') return { ok: true, skipped: 'no-row' };

  const config: Record<string, unknown> = rule.config && typeof rule.config === 'object' ? rule.config : {};
  const raw = (row as Record<string, unknown>)[column];
  const isEmpty = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');

  if (kind === 'required') {
    return isEmpty ? { ok: false, reason: `${column} is required but empty` } : { ok: true };
  }

  // Presence belongs to `required` — every other kind only judges a value that is actually there.
  if (isEmpty) return { ok: true, skipped: 'empty' };

  if (kind === 'range') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n)) return { ok: false, reason: `${column} is not numeric: ${JSON.stringify(raw)}` };
    const min = typeof config.min === 'number' ? config.min : null;
    const max = typeof config.max === 'number' ? config.max : null;
    if (min !== null && n < min) return { ok: false, reason: `${column}=${n} is below the minimum ${min}` };
    if (max !== null && n > max) return { ok: false, reason: `${column}=${n} is above the maximum ${max}` };
    return { ok: true };
  }

  if (kind === 'regex') {
    const pattern = typeof config.pattern === 'string' ? config.pattern : '';
    if (pattern === '') return { ok: true, skipped: 'invalid-pattern' };
    let re: RegExp | null = null;
    try {
      re = new RegExp(pattern, typeof config.flags === 'string' ? config.flags : undefined);
    } catch {
      re = null;
    }
    // An unrunnable rule NEVER creates a violation — it is a broken rule, not a broken row.
    if (re === null) return { ok: true, skipped: 'invalid-pattern' };
    let matched = false;
    try {
      matched = re.test(String(raw));
    } catch {
      return { ok: true, skipped: 'invalid-pattern' };
    }
    return matched ? { ok: true } : { ok: false, reason: `${column} does not match /${pattern}/` };
  }

  if (kind === 'enum') {
    const values = Array.isArray(config.values) ? config.values : null;
    if (values === null || values.length === 0) return { ok: true, skipped: 'no-values' };
    const s = String(raw);
    return values.some((v) => String(v) === s)
      ? { ok: true }
      : { ok: false, reason: `${column}=${JSON.stringify(raw)} is not one of ${values.map((v) => String(v)).join(', ')}` };
  }

  if (kind === 'reference') {
    if (!Array.isArray(refIds)) return { ok: true, skipped: 'no-ref-ids' };
    const s = String(raw).trim();
    const known = refIds.some((p) => p !== null && p !== undefined && typeof p !== 'object' && String(p).trim() === s);
    const table = typeof config.table === 'string' && config.table !== '' ? config.table : 'the referenced table';
    return known ? { ok: true } : { ok: false, reason: `${column}=${s} has no matching row in ${table}` };
  }

  return { ok: true, skipped: 'unknown-kind' };
}
