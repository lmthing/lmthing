/**
 * De-duplicate a list of destination names case-insensitively, preserving the order of first
 * occurrence (and the casing of the first occurrence).
 */
export function dedupeDestinations(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}
