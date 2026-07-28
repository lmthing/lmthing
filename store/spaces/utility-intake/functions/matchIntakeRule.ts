/**
 * Pick the first ACTIVE rule whose matcher matches a payload — pure, never throws.
 *
 * A matcher is data, not code: `{ equals?: {path: value}, contains?: {path: substring},
 * exists?: [path] }`, where a path is dot-notation into the payload (`'a.b.c'`). Every stated
 * condition must hold (AND). A malformed matcher — not an object, unknown shape, unparseable —
 * never matches, so a broken rule silently routes nothing instead of capturing everything.
 *
 * Rules are evaluated in the order given; the caller sorts them (by `createdAt`) so ordering is a
 * deliberate, inspectable property rather than a database accident.
 *
 * @param rules   Rule rows: `{ id?, status, matcherJson }` (matcherJson is a JSON string).
 * @param payload The parsed intake payload.
 */
export function matchIntakeRule(
  rules: Record<string, unknown>[] | null | undefined,
  payload: unknown,
): { rule: Record<string, unknown> | null; matched: boolean } {
  const NO_MATCH = { rule: null, matched: false };
  if (!Array.isArray(rules)) return NO_MATCH;

  const at = (obj: unknown, path: string): unknown => {
    if (typeof path !== 'string' || path === '') return undefined;
    let cur: unknown = obj;
    for (const seg of path.split('.')) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  };

  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    if (String(rule['status'] ?? '') !== 'active') continue;

    let matcher: unknown;
    try {
      const raw = rule['matcherJson'];
      matcher = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      continue; // unparseable matcher never matches
    }
    if (!matcher || typeof matcher !== 'object' || Array.isArray(matcher)) continue;

    const m = matcher as { equals?: unknown; contains?: unknown; exists?: unknown };
    const hasClause =
      (m.equals && typeof m.equals === 'object') ||
      (m.contains && typeof m.contains === 'object') ||
      Array.isArray(m.exists);
    if (!hasClause) continue; // an empty matcher would match everything — refuse it

    let ok = true;

    if (m.equals && typeof m.equals === 'object' && !Array.isArray(m.equals)) {
      for (const [path, expected] of Object.entries(m.equals as Record<string, unknown>)) {
        const actual = at(payload, path);
        // Compare as strings so 1 and "1" from JSON round-trips agree.
        if (actual === undefined || String(actual) !== String(expected)) { ok = false; break; }
      }
    }

    if (ok && m.contains && typeof m.contains === 'object' && !Array.isArray(m.contains)) {
      for (const [path, needle] of Object.entries(m.contains as Record<string, unknown>)) {
        const actual = at(payload, path);
        if (actual === undefined || !String(actual).toLowerCase().includes(String(needle).toLowerCase())) { ok = false; break; }
      }
    }

    if (ok && Array.isArray(m.exists)) {
      for (const path of m.exists) {
        const actual = at(payload, String(path));
        if (actual === undefined || actual === null || actual === '') { ok = false; break; }
      }
    }

    if (ok) return { rule, matched: true };
  }

  return NO_MATCH;
}
