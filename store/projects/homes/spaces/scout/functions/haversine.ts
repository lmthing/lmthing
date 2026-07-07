/**
 * Great-circle distance in meters between two lat/lng points (haversine).
 * Used by the locator to intersect textual clues (each clue → a coordinate + a
 * tolerance) and by commute estimation as a straight-line floor. Deterministic.
 */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // earth radius, meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * Intersect a set of clue circles (each a point + radius the clue implies) into a
 * single best guess: the point minimizing summed distance to the clues, with a
 * radius = spread of the clues. More agreeing clues ⇒ tighter radius ⇒ higher
 * confidence. Returns null when there are no clues to work from.
 */
export function intersectClues(
  clues: { lat: number; lng: number; radiusM: number; weight?: number }[],
): { lat: number; lng: number; radiusM: number; confidence: number } | null {
  if (!clues.length) return null;
  const totalW = clues.reduce((s, c) => s + (c.weight ?? 1), 0);
  const lat = clues.reduce((s, c) => s + c.lat * (c.weight ?? 1), 0) / totalW;
  const lng = clues.reduce((s, c) => s + c.lng * (c.weight ?? 1), 0) / totalW;
  const center = { lat, lng };
  const spread = clues.reduce((max, c) => Math.max(max, haversine(center, c) + c.radiusM), 0);
  // Confidence rises with clue count and falls with spread. Bounded 0.15..0.95.
  const agreement = Math.min(1, clues.length / 3);
  const tightness = 1 - Math.min(1, spread / 1200);
  const confidence = Math.max(0.15, Math.min(0.95, 0.4 * agreement + 0.6 * tightness));
  return { lat, lng, radiusM: Math.max(60, Math.round(spread)), confidence: Math.round(confidence * 100) / 100 };
}
