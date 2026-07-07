---
title: Cost & commute surveyor
defaultAction: normalize
actions:
  - id: normalize
    label: Compute true cost & commutes
    description: Turn a listing's asking price into an all-in monthly cost, and compute cited commute times to the search's targets.
  - id: commute
    label: Recompute commutes
    description: Recompute commute estimates for a listing against its search's current commuteTargets (e.g. after the user edits them).
knowledge:
  - home-intake/true-cost
  - home-intake/commute-estimation
capabilities:
  - db:read:  { tables: [searches, listings, commutes] }
  - db:write: { tables: [listings, commutes] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: normalize

Invoked with `input.listingId` as a hint (from the `enrich-new-listing` hook) — self-scan every
listing still at its zero default so a straggler from a partial prior run gets picked up too:

```ts
const listings = db.query('listings', { where: { trueCostMonthly: 0 } });

for (const listing of listings) {
  const search = db.query('searches', { where: { id: listing.searchId } })[0];

  // `trueCost` does the arithmetic; every input the surveyor supplies for the estimated
  // lines is cited — a made-up-sounding annualRatePct needs a real rateSource.
  const result = trueCost({
    mode: search.mode,
    priceAmount: listing.priceAmount,
    currency: listing.currency,
    areaSqm: listing.areaSqm,
    // buy-mode knobs — only meaningful when search.mode === 'buy':
    annualRatePct: 3.7, // e.g. from a webSearch("current 30-year mortgage rate <country>") a moment ago
    rateSource: 'ECB reference mortgage rate survey, cited at compute time',
  });

  db.update('listings', listing.id, {
    trueCostMonthly: result.trueCostMonthly,
    costBreakdown: result.breakdown,
  });

  // Round 1: fold commute computation into the same loop pass as normalize.
  for (const target of search.commuteTargets ?? []) {
    const already = db
      .query('commutes', { where: { listingId: listing.id } })
      .find((c) => c.targetLabel === target.label);
    if (already) continue; // idempotent per (listing, target)

    // webSearch transit directions from the best available location guess — normalize
    // runs before the locator in the enrich-new-listing pipeline, so early listings use
    // the claimed pin; a later re-run (via the `commute` action) can use a tightened guess.
    const hits = webSearch(
      `transit directions from ${listing.address || `${listing.claimedLat},${listing.claimedLng}`} to ${target.address}`,
    );
    const minutes = 0; // parsed from `hits` — never invent a number without a real source hit

    db.insert('commutes', {
      listingId: listing.id,
      targetLabel: target.label,
      mode: target.mode,
      minutes,
      basis: `from claimed pin (${listing.address || `${listing.claimedLat},${listing.claimedLng}`}) — ${target.mode} directions to ${target.address}, cited: ${hits[0]?.url ?? 'no source found'}`,
    });
  }
}
```

## Action: commute

Invoked directly (e.g. the user edits a search's `commuteTargets`, or the locator later tightens a
location guess and a re-check is worth it). Same per-target logic as above, scoped to one listing:

```ts
const listing = db.query('listings', { where: { id: listingId } })[0];
const search = db.query('searches', { where: { id: listing.searchId } })[0];

for (const target of search.commuteTargets ?? []) {
  const hits = webSearch(`transit directions to ${target.address}`);
  const minutes = 0; // parsed from hits

  db.insert('commutes', {
    listingId: listing.id,
    targetLabel: target.label,
    mode: target.mode,
    minutes,
    basis: `recomputed — ${target.mode} directions to ${target.address}, cited: ${hits[0]?.url ?? 'no source found'}`,
  });
}
```

Guardrails:

- `where` is equality-only — filter/sort in memory (e.g. matching a `commutes` row to its
  `targetLabel`) rather than trying a compound query.
- Every `costBreakdown` line states `basis: 'stated' | 'estimated'` — never merge the two into one
  unlabelled figure.
- A cited `annualRatePct`/`rateSource` beats a remembered-from-training-data rate — prefer a fresh
  `webSearch` when the estimate materially affects the true cost.
- Commute `basis` always names the starting point used (claimed pin vs. a location guess) and the
  mode/target — a user comparing two listings needs to know they weren't measured the same way if
  one used a tighter guess than the other.
- Never invent a commute number when a search comes back empty — leave `minutes` low-confidence and
  say so in `basis` rather than guessing a plausible-looking time.
