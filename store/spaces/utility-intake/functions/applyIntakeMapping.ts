/**
 * Project a payload onto a target row using a declarative mapping — pure, never throws.
 *
 * A mapping is `{ [targetColumn]: sourcePath | { path, fallback? } }`, where a path is dot-notation
 * into the payload. A path that resolves to nothing uses `fallback` when one is given, and is
 * otherwise OMITTED from the row (never written as null/empty) — the target table's own defaults
 * decide what a missing column means, not this function. Objects and arrays are stringified so a
 * nested blob still lands as inspectable text rather than `[object Object]`.
 *
 * @returns `{ row, missing }` — `missing` lists target columns whose path resolved to nothing and
 *          had no fallback, so a caller can report a partial mapping honestly.
 */
export function applyIntakeMapping(
  mapping: unknown,
  payload: unknown,
): { row: Record<string, unknown>; missing: string[] } {
  const EMPTY = { row: {} as Record<string, unknown>, missing: [] as string[] };
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return EMPTY;

  const at = (obj: unknown, path: string): unknown => {
    if (typeof path !== 'string' || path === '') return undefined;
    let cur: unknown = obj;
    for (const seg of path.split('.')) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  };

  const coerce = (v: unknown): string | number | boolean => {
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return v;
    try {
      return JSON.stringify(v) ?? '';
    } catch {
      return String(v);
    }
  };

  const row: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const [target, spec] of Object.entries(mapping as Record<string, unknown>)) {
    let path = '';
    let fallback: unknown;
    let hasFallback = false;

    if (typeof spec === 'string') {
      path = spec;
    } else if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
      const s = spec as { path?: unknown; fallback?: unknown };
      path = typeof s.path === 'string' ? s.path : '';
      if ('fallback' in s) { fallback = s.fallback; hasFallback = true; }
    } else {
      missing.push(target);
      continue;
    }

    const value = at(payload, path);
    if (value === undefined || value === null || value === '') {
      if (hasFallback) row[target] = coerce(fallback);
      else missing.push(target);
      continue;
    }
    row[target] = coerce(value);
  }

  return { row, missing };
}
