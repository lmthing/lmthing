/**
 * Intersect a set of clue circles (each a point + the radius the clue implies)
 * into a single best location guess: a weighted centroid, with a radius = the
 * spread of the clues and a confidence that rises with clue count and falls with
 * spread. More agreeing clues ⇒ tighter circle ⇒ higher confidence. Returns null
 * when there are no clues to work from — the locator then falls back to the
 * claimed (fuzzed) pin with a wide radius and low confidence.
 *
 * Self-contained (inlines the great-circle distance) so it injects cleanly as a
 * single agent function. See `location-triangulation/clue-extraction-and-intersection`.
 */
export function intersectClues(
  clues: { lat: number; lng: number; radiusM: number; weight?: number }[],
): { lat: number; lng: number; radiusM: number; confidence: number } | null {
  if (!clues.length) return null;
  const totalW = clues.reduce((s, c) => s + (c.weight ?? 1), 0);
  const lat = clues.reduce((s, c) => s + c.lat * (c.weight ?? 1), 0) / totalW;
  const lng = clues.reduce((s, c) => s + c.lng * (c.weight ?? 1), 0) / totalW;
  const center = { lat, lng };
  const spread = clues.reduce((max, c) => Math.max(max, distM(center, c) + c.radiusM), 0);
  const agreement = Math.min(1, clues.length / 3);
  const tightness = 1 - Math.min(1, spread / 1200);
  const confidence = Math.max(0.15, Math.min(0.95, 0.4 * agreement + 0.6 * tightness));
  return { lat, lng, radiusM: Math.max(60, Math.round(spread)), confidence: Math.round(confidence * 100) / 100 };
}

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}
