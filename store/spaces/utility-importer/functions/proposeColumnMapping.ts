/**
 * Propose source-header → target-column pairings by name similarity — pure, never throws.
 *
 * Three tiers, each an exact rule rather than a fuzzy score, so the same input always yields the
 * same proposal and a human can see WHY a pair was suggested:
 *   1.0  case-insensitive exact match
 *   0.8  match after normalizing snake/camel/kebab/space to a bare lowercase token
 *   0.6  normalized match after naive singularization (trailing `s` on tokens longer than 3)
 * Anything else is `target: null` at confidence 0 — unmapped, for the user to decide.
 *
 * A target column is claimed at most once; the earliest (highest-tier, then first-seen) source
 * wins, so two similar headers cannot both map onto one column.
 */
export function proposeColumnMapping(
  sourceHeaders: unknown,
  targetColumns: unknown,
): { source: string; target: string | null; confidence: number }[] {
  const sources = Array.isArray(sourceHeaders) ? sourceHeaders.filter((h): h is string => typeof h === 'string') : [];
  const targets = Array.isArray(targetColumns) ? targetColumns.filter((c): c is string => typeof c === 'string') : [];
  if (sources.length === 0) return [];

  const norm = (s: string): string => s.trim().toLowerCase().replace(/[\s_-]+/g, '').replace(/([a-z])([A-Z])/g, '$1$2');
  const singular = (s: string): string =>
    norm(s).length > 3 && norm(s).endsWith('s') ? norm(s).slice(0, -1) : norm(s);

  const taken = new Set<string>();
  const out: { source: string; target: string | null; confidence: number }[] = [];

  // Pass by tier so a weaker match can never steal a column an exact match wants.
  const decided = new Map<string, { target: string; confidence: number }>();
  const tiers: { conf: number; key: (s: string) => string }[] = [
    { conf: 1, key: (s) => s.trim().toLowerCase() },
    { conf: 0.8, key: norm },
    { conf: 0.6, key: singular },
  ];

  for (const { conf, key } of tiers) {
    for (const source of sources) {
      if (decided.has(source)) continue;
      const want = key(source);
      const hit = targets.find((t) => !taken.has(t) && key(t) === want);
      if (hit) { decided.set(source, { target: hit, confidence: conf }); taken.add(hit); }
    }
  }

  for (const source of sources) {
    const d = decided.get(source);
    out.push(d ? { source, target: d.target, confidence: d.confidence } : { source, target: null, confidence: 0 });
  }
  return out;
}
