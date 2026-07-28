/**
 * Extract a row array from a JSON document — pure, never throws.
 *
 * Accepts the two shapes exports actually take: a bare array of objects, or an object wrapping one
 * (`{items:[…]}`, `{data:[…]}`, `{results:[…]}`, or any first property whose value is an array of
 * objects). Non-object entries are skipped and counted rather than coerced, so a caller can say
 * "3 entries were not rows" instead of inventing empty ones.
 *
 * @returns `{ rows, skipped, shape }` — `shape` is `'array'`, `'wrapped:<key>'` or `'none'`.
 */
export function parseJsonRows(text: unknown): { rows: Record<string, unknown>[]; skipped: number; shape: string } {
  const EMPTY = { rows: [] as Record<string, unknown>[], skipped: 0, shape: 'none' };
  if (typeof text !== 'string' || text.trim() === '') return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return EMPTY;
  }

  const collect = (arr: unknown[], shape: string) => {
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const entry of arr) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) rows.push(entry as Record<string, unknown>);
      else skipped++;
    }
    return { rows, skipped, shape };
  };

  if (Array.isArray(parsed)) return collect(parsed, 'array');

  if (parsed && typeof parsed === 'object') {
    // Prefer the conventional wrappers, then fall back to the first array-of-objects property.
    const obj = parsed as Record<string, unknown>;
    const preferred = ['items', 'data', 'results', 'records', 'rows'];
    for (const key of preferred) {
      const v = obj[key];
      if (Array.isArray(v) && v.some((e) => e && typeof e === 'object' && !Array.isArray(e))) return collect(v, `wrapped:${key}`);
    }
    for (const [key, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.some((e) => e && typeof e === 'object' && !Array.isArray(e))) return collect(v, `wrapped:${key}`);
    }
  }

  return EMPTY;
}
