---
title: Location triangulator
defaultAction: locate
actions:
  - id: locate
    label: Locate a listing
    description: Triangulate a confidence-scored location guess from the claimed pin and textual clues (street names, named landmarks, "N min from X" mentions).
knowledge:
  - home-scout/location-triangulation
functions:
  - haversine
  - intersectClues
capabilities:
  - db:read:  { tables: [listings, listing_analyses] }
  - db:write: { tables: [location_guesses] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: locate

Invoked with `input.listingId` as a hint (from the `enrich-new-listing` hook) — self-scan every
listing that doesn't have a guess yet:

```ts
const located = new Set(db.query('location_guesses').map((g) => g.listingId));
const listings = db.query('listings').filter((l) => !located.has(l.id));

for (const listing of listings) {
  const clues = [];
  const citations = [];

  // Start from the claimed pin — portals fuzz it by a few hundred meters, so it's a
  // clue like any other, not ground truth, but it's usually the best starting circle.
  if (listing.claimedLat && listing.claimedLng) {
    clues.push({ lat: listing.claimedLat, lng: listing.claimedLng, radiusM: 300, weight: 1 });
    citations.push('claimed map pin (±~300m, typical portal fuzzing)');
  }

  // Extract textual clues from the description and any analyst notes: street names,
  // "N min from <metro/landmark>" mentions, named cafés/schools in photo captions.
  const text = [
    listing.description ?? '',
    ...(listing.photoUrls ?? []).map((p: { caption?: string }) => p.caption ?? ''),
  ].join('\n');

  // e.g. a street-name match or a "5 min from X" mention found in `text` — webSearch the
  // named place/street for its coordinates, then push a clue circle sized to how precise
  // the mention was ("2 min walk from X" ⇒ a small radius; "near X neighborhood" ⇒ a
  // larger one), citing exactly which phrase produced it.
  const namedClue = null as null | { lat: number; lng: number; radiusM: number; source: string };
  if (namedClue) {
    clues.push({ lat: namedClue.lat, lng: namedClue.lng, radiusM: namedClue.radiusM, weight: 1.2 });
    citations.push(namedClue.source);
  }

  const guess = intersectClues(clues);

  if (guess) {
    db.insert('location_guesses', {
      listingId: listing.id,
      lat: guess.lat,
      lng: guess.lng,
      radiusM: guess.radiusM,
      confidence: guess.confidence,
      method: citations.map((c, i) => `${i + 1}. ${c}`).join('; '),
    });
  } else {
    // Clue-poor: no claimed pin AND no extractable textual clue. Still write a guess —
    // callers (the ranker, the map view) expect one row per listing — but wide and
    // honestly near-zero confidence, saying plainly why.
    db.insert('location_guesses', {
      listingId: listing.id,
      lat: 0,
      lng: 0,
      radiusM: 5000,
      confidence: 0.05,
      method: 'No claimed pin and no extractable location clue in the description or captions — this is not a usable guess, only a placeholder.',
    });
  }
}
```

Guardrails:

- `where` is equality-only — filter/sort in memory (matching guesses to listings, deduping clue
  sources) rather than a compound query.
- Never claim the true address — `method` always frames the result as a guess with a stated radius,
  never as a confirmed location.
- Every clue in `method` is cited to the specific text it came from — a bare "triangulated from
  nearby landmarks" without naming which landmarks and which phrases is not acceptable.
- Clue-poor listings get a WIDE, LOW-confidence circle, never a narrow one padded out with
  unstated assumptions to look more precise than the evidence supports.
- Round 1 scope: `locate` writes only to `location_guesses` — it does not attempt to also update
  `listings` or recompute commutes; the surveyor's `commute` action is the place a tightened guess
  gets used for a commute re-check.
