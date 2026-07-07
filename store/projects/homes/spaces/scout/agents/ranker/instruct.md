---
title: Taste ranker
defaultAction: rank
actions:
  - id: rank
    label: Rank listings
    description: Score listings against the search's taste model, true cost, commutes, and hard constraints; alert on a strong fresh match.
  - id: learn
    label: Learn from signals
    description: Fold unfolded taste_signals (saves, dismisses with reasons, contacts) into cited taste_notes and re-rank affected listings.
    tasklist: learn-taste
knowledge:
  - home-scout/taste-learning
capabilities:
  - db:read:  { tables: [searches, listings, listing_analyses, location_guesses, commutes, taste_signals, taste_notes] }
  - db:write: { tables: [listings, taste_notes, taste_signals, alerts] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: rank

Invoked with `input.listingId` as a hint (from the `enrich-new-listing` hook) — self-scan every
listing still at its zero score, so a listing that changed (a signal re-ranked it back to 0, see
below) or a straggler from a partial prior run both get picked up:

```ts
const listings = db.query('listings', { where: { score: 0 } });

for (const listing of listings) {
  const search = db.query('searches', { where: { id: listing.searchId } })[0];
  const notes = db.query('taste_notes', { where: { searchId: search.id } });
  const commutes = db.query('commutes', { where: { listingId: listing.id } });

  // Map this listing's actual evidence (fields, description, analyst findings) onto each
  // taste dimension: how well does it support or contradict the note's statement?
  // match ∈ [-1 (contradicts), 1 (clearly supports)], 0 = no signal either way. This is
  // model judgment grounded in the listing's own text — never a guess disconnected from it.
  const noteMatches = notes.map((note) => ({
    weight: note.weight,
    dimension: note.dimension,
    match: 0, // e.g. +1 if the listing's description/analyses clearly support note.statement
  }));

  const commuteOverBy = (search.commuteTargets ?? []).map((target: { label: string; maxMinutes: number }) => {
    const c = commutes.find((row) => row.targetLabel === target.label);
    return c ? c.minutes - target.maxMinutes : 0;
  });

  // A must-have with no supporting evidence in the listing fails safe (counts as violated)
  // rather than being assumed present; a dealbreaker-weight note the listing contradicts
  // (match === -1, weight ≥ ~0.9) is the same kind of hard stop.
  const hardMustHaveViolated = false; // set true when a search.mustHaves entry is clearly unmet
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
    violatesHardConstraint: hardMustHaveViolated || dealbreakerViolated,
  });

  // `score === 0` alone doesn't distinguish "never ranked" from "reset to 0 by `learn`'s
  // re-rank step" — the learn-taste tasklist deliberately resets ONLY `score`, leaving a
  // previous `scoreSummary` in place, precisely so this check can tell the two apart.
  const isFreshListing = !listing.scoreSummary;

  // Humanize each deterministic component with the evidence that actually produced it —
  // e.g. "+20 light note" becomes "+ bright corner unit [light note w0.8]" once you name
  // WHICH note/commute/flag it came from; blendScore's own labels are the math, this is the citation.
  const summaryLines = result.components.map((c) => `${c.delta >= 0 ? '+' : '−'} ${c.label} (${c.delta})`);

  db.update('listings', listing.id, {
    score: result.score,
    scoreSummary: summaryLines.join('\n'),
  });

  if (result.score >= 80 && isFreshListing) {
    // The ranker writes the alert itself — there is no separate alert hook. This is the
    // one insert that legitimately fires FROM a listings-derived scoring pass, and it
    // inserts into `alerts`, not `listings`, so it never re-triggers enrich-new-listing.
    db.insert('alerts', {
      searchId: search.id,
      listingId: listing.id,
      kind: 'new_match',
      title: `Strong match: ${listing.title} scored ${result.score}`,
      body: summaryLines.join('\n'),
    });
  }
}
```

## Action: learn

Invoked with `input.searchId` (from the `learn-from-signal` hook, fired the moment a save/dismiss/
contact is recorded). Run the `learn-taste` tasklist rather than orchestrating the steps yourself:

```ts
const t = await tasklist('learn-taste', { searchId });
```

It resolves once every currently-unfolded `taste_signals` row for this search has been distilled
into `taste_notes`, folded (`folded: true`), and every listing that note touches has been reset to
`score: 0` so the `rank` action above re-scores it against the updated model.

Guardrails:

- `where` is equality-only — filter/sort in memory for anything beyond exact matches (matching a
  `commutes` row to its `targetLabel`, checking a note's dimension).
- `scoreSummary` always cites the SPECIFIC notes and constraints that moved the score, in both
  directions — a bare number with no citation defeats the point of an inspectable taste model.
- A hard must-have or dealbreaker violation caps the score at 45 regardless of how well everything
  else matches — never let a strong taste-note match override a stated hard constraint.
- Only insert a `new_match` alert for a listing being scored for the FIRST time (`score` was still
  at its untouched default) — a listing that re-crosses 80 after a re-rank from `learn` doesn't need
  a second "new match" alert; that's a re-rank, not a fresh discovery.
