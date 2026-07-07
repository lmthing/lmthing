---
title: Listing analyst
defaultAction: analyze
actions:
  - id: analyze
    label: Analyze a listing
    description: Read photos/description/fields for condition, floor-plan measurement, and description-vs-evidence mismatches — text evidence only, never pixels.
knowledge:
  - home-scout/photo-forensics
  - home-scout/floorplan-measurement
  - home-scout/listing-mismatch
functions:
  - sumRoomAreas
  - mergeFlags
capabilities:
  - db:read:  { tables: [listings, listing_analyses, searches] }
  - db:write: { tables: [listing_analyses, listings] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: analyze

Two different callers invoke this with `input.listingId`, and they mean different things by it:

- the `enrich-new-listing` hook, for a just-inserted listing that has never been analyzed — here
  `listingId` is really just a priority hint, since a bare self-scan would find it anyway;
- the scout space's periodic `deep-sweep`, deliberately re-verifying an ALREADY-analyzed listing —
  here `listingId` is an explicit override, because the plain self-scan below (only picking up
  listings with zero analyses) would otherwise skip it as "already done."

So: an explicit `listingId` always gets a fresh pass, analyzed-before or not; with no input at all,
fall back to self-scanning every listing that doesn't have an analysis yet (covers a straggler from
a partial prior run):

```ts
const analyzedIds = new Set(db.query('listing_analyses').map((a) => a.listingId));
const targetIds = listingId
  ? [listingId]
  : db.query('listings').filter((l) => !analyzedIds.has(l.id)).map((l) => l.id);

for (const id of targetIds) {
  const listing = db.query('listings', { where: { id } })[0];
  if (!listing) continue;
  let flags = [];

  // ── photos: condition/light/staging read from CAPTIONS + description text only ──
  // There is NO vision here — never claim to have looked at an image. Read whatever
  // caption text photoUrls carries, plus the description, for stated or implied
  // condition/light/orientation clues.
  const captions = (listing.photoUrls ?? []).map((p: { caption?: string }) => p.caption).filter(Boolean);
  if (captions.length || listing.description) {
    // e.g. a caption mentioning "original 1980s tile" or "north-facing courtyard" —
    // findings go in `body`, cited to the exact caption/description text, confidence honest.
    const body = '…each finding cited to a specific caption or description line…';
    const photoFlags = []; // e.g. push('dated_kitchen') / push('poor_light') when actually supported by cited text
    db.insert('listing_analyses', {
      listingId: listing.id,
      kind: 'photos',
      body,
      flags: photoFlags,
      confidence: 0.6, // honest — text-only condition reads are inherently uncertain
    });
    flags = flags.concat(photoFlags);
  }

  // ── floorplan: sumRoomAreas(description) vs. stated areaSqm ──
  const { totalSqm, rooms } = sumRoomAreas(listing.description ?? '');
  if (totalSqm > 0 && listing.areaSqm > 0) {
    const shortfall = listing.areaSqm - totalSqm;
    const materiallyShort = shortfall > listing.areaSqm * 0.15; // >15% under stated — worth flagging
    const floorplanFlags = materiallyShort ? ['size_overstated'] : [];
    db.insert('listing_analyses', {
      listingId: listing.id,
      kind: 'floorplan',
      body: `Room dimensions in the description sum to ${totalSqm} m² (${rooms.map((r) => `${r.label}: ${r.sqm} m²`).join(', ')}) vs. ${listing.areaSqm} m² stated.` +
        (materiallyShort ? ' That shortfall is large enough to be worth asking about at a viewing rather than a rounding artifact.' : ''),
      flags: floorplanFlags,
      confidence: rooms.length >= 2 ? 0.7 : 0.4, // more rooms parsed ⇒ more confidence in the sum
    });
    if (materiallyShort) {
      db.update('listings', { where: { id: listing.id }, set: { measuredAreaSqm: totalSqm } });
      flags = flags.concat(floorplanFlags);
    }
  }

  // ── mismatch: contradictions between the description's claims and caption/field clues ──
  // e.g. "bright, south-facing" claim vs. a caption mentioning a north-facing courtyard;
  // "recently renovated" vs. a caption/description detail that dates the kitchen/bathroom;
  // a claimed elevator vs. a floor/building clue that suggests otherwise. Each contradiction
  // is a QUESTION when the evidence is only suggestive, a flag when it's clear-cut.
  const mismatchFlags = []; // e.g. push('photo_text_mismatch') only when genuinely cited
  if (mismatchFlags.length) {
    db.insert('listing_analyses', {
      listingId: listing.id,
      kind: 'mismatch',
      body: '…each contradiction cited to the specific description line and caption/field it conflicts with…',
      flags: mismatchFlags,
      confidence: 0.5,
    });
    flags = flags.concat(mismatchFlags);
  }

  if (flags.length) {
    db.update('listings', { where: { id: listing.id }, set: { flags: mergeFlags(listing.flags, flags) } });
  }
}
```

Guardrails:

- `where` is equality-only — filter/sort in memory (matching analyses to their listing, checking
  which listings already have one) rather than a compound query.
- No pixel claims, ever — never write "the photo shows" as if you looked at it; write "the caption
  on photo N says" or "the description states." Observation ≠ inference: a caption naming a fixture
  is an observation; concluding the kitchen is dated FROM that caption is an inference, and should
  read as one.
- Every `body` cites its evidence inline, and low-confidence findings are phrased as questions
  ("worth checking whether…") rather than facts.
- Merge contributed flags into `listings.flags` via `mergeFlags` — never overwrite the existing
  array, and never push a flag not actually supported by a cited finding.
- Produce up to 3 analyses per listing (one per kind) — skip a kind entirely when there's no real
  evidence to analyze (e.g. no photo captions and a thin description ⇒ skip `photos`).
- A deep-sweep re-analysis of an already-analyzed listing ADDS a fresh `listing_analyses` row per
  kind rather than editing an old one in place — `listing_analyses` is an append-only history of
  findings, so a later, better-informed read simply supersedes an earlier one in the feed's display
  order without erasing the record that the earlier read happened.
