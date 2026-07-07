/**
 * Re-derive a listing's usable size by summing per-room dimensions found in the
 * floor-plan labels / description text, so the analyst can cross-check it against
 * the STATED `areaSqm` and flag `size_overstated` when the sum falls materially
 * short. Deterministic parsing only — the model supplies the text, this counts.
 *
 * Recognizes the common label idioms: `Sala 18 m²`, `Bedroom 3.4 x 4.1`,
 * `Kitchen 12,5 m2`, `Quarto 3.0x3.5m`. A `A x B` dimension multiplies; a bare
 * `N m²` adds directly. Returns the sum and the parsed rooms so the finding can
 * cite each ("room dims sum to 71 m² vs 85 stated"). See `floorplan-measurement/`.
 */
export interface RoomArea {
  label: string;
  sqm: number;
  basis: 'stated_area' | 'multiplied_dims';
}

export function sumRoomAreas(text: string): { totalSqm: number; rooms: RoomArea[] } {
  const raw = String(text ?? '');
  const rooms: RoomArea[] = [];

  // "Label 3.4 x 4.1" (dimensions in meters) → area
  const dimRe = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ /]{1,24}?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m?\b/gi;
  for (const m of raw.matchAll(dimRe)) {
    const a = Number(m[2].replace(',', '.'));
    const b = Number(m[3].replace(',', '.'));
    if (a > 0 && b > 0 && a < 40 && b < 40) {
      rooms.push({ label: m[1].trim(), sqm: round1(a * b), basis: 'multiplied_dims' });
    }
  }

  // "Label 18 m²" (direct area) — only if not already captured as a dimension pair.
  // NB: no trailing \b — `²` is not a word char, so `m²\b` would fail to match
  // "18 m²." while "m2" matched; a negative lookahead guards against "m20".
  const areaRe = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ /]{1,24}?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:m²|m2|sqm)(?![a-z0-9])/gi;
  for (const m of raw.matchAll(areaRe)) {
    const label = m[1].trim();
    const sqm = round1(Number(m[2].replace(',', '.')));
    if (sqm > 0 && sqm < 200 && !rooms.some((r) => r.label.toLowerCase() === label.toLowerCase())) {
      rooms.push({ label, sqm, basis: 'stated_area' });
    }
  }

  const totalSqm = round1(rooms.reduce((s, r) => s + r.sqm, 0));
  return { totalSqm, rooms };
}

function round1(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
}
