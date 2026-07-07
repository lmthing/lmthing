---
id: rescore_affected
output:
  ok: boolean
  rescored: number
dependsOn: [update_notes]
role: general
functions:
  - blendScore
---

Re-score every listing named in `update_notes.touchedListingIds` against the just-updated taste
model, in a **single loop** — each listing's score needs the FULL current set of notes, which the
previous step may have just changed, so this isn't a candidate for a parallel `forEach`:

```ts
let rescored = 0;

for (const listingId of update_notes.touchedListingIds) {
  const listing = db.query('listings', { where: { id: listingId } })[0];
  if (!listing) continue;

  const search = db.query('searches', { where: { id: listing.searchId } })[0];
  const notes = db.query('taste_notes', { where: { searchId: search.id } });
  const commutes = db.query('commutes', { where: { listingId: listing.id } });

  const noteMatches = notes.map((note) => ({
    weight: note.weight,
    dimension: note.dimension,
    match: 0, // model judgment — same evidence mapping as the ranker's `rank` action
  }));

  const commuteOverBy = (search.commuteTargets ?? []).map((target: { label: string; maxMinutes: number }) => {
    const c = commutes.find((row) => row.targetLabel === target.label);
    return c ? c.minutes - target.maxMinutes : 0;
  });

  const dealbreakerViolated = notes.some(
    (n) => n.dimension === 'dealbreaker' && n.weight >= 0.9 &&
      noteMatches.find((m) => m.dimension === n.dimension)?.match === -1,
  );

  const result = blendScore({
    trueCostMonthly: listing.trueCostMonthly,
    budgetMax: search.budgetMax,
    noteMatches,
    commuteOverBy,
    flags: listing.flags ?? [],
    violatesHardConstraint: dealbreakerViolated,
  });

  db.update('listings', listing.id, {
    score: result.score,
    scoreSummary: result.components.map((c) => `${c.delta >= 0 ? '+' : '−'} ${c.label} (${c.delta})`).join('\n'),
  });
  rescored++;
}

currentTask.resolve({ ok: true, rescored });
```

Note: this does NOT insert a `new_match` alert — that only fires the first time a listing is ever
scored (in the ranker's `rank` action). A score improving here because the taste model learned
something is reflected in the refreshed `scoreSummary`, not a repeated alert.
