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
  - id: digest
    label: Daily state-of-the-hunt digest
    description: Per active search, summarize what changed (new matches, price drops on the shortlist, best current option, market vs cap) into one alerts row of kind 'digest'.
  - id: review
    label: Review a shortlist
    description: Reason across a SET of listings (trade-offs, what they share, near-duplicate decisions) and recommend a viewing order — returned as prose to the caller, writes nothing.
knowledge:
  - home-scout/taste-learning
functions:
  - blendScore
  - mergeFlags
capabilities:
  - db:read:  { tables: [searches, listings, listing_analyses, location_guesses, commutes, taste_signals, taste_notes, alerts] }
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

  db.update('listings', {
    where: { id: listing.id },
    set: {
      score: result.score,
      scoreSummary: summaryLines.join('\n'),
    },
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

## Action: digest

Invoked by the `daily-digest` cron with no input — self-scan every ACTIVE search and write ONE
`alerts` row of `kind: 'digest'` per search summarizing the state of the hunt. This is a briefing
the user receives, not a feed they scan; keep it short, concrete, and actionable.

```ts
const searches = db.query('searches', { where: { status: 'active' } });
const since = new Date(Date.now() - 24 * 3600_000).toISOString(); // last 24h

for (const search of searches) {
  const listings = db.query('listings', { where: { searchId: search.id } });
  const alerts = db.query('alerts', { where: { searchId: search.id } });

  // In-memory filtering — `where` is equality-only.
  const fresh = listings.filter((l) => (l.firstSeenAt ?? '') >= since);
  const strongNew = fresh.filter((l) => (l.score ?? 0) >= 80).length;
  const shortlisted = listings.filter((l) => l.status === 'shortlisted');
  const recentDrops = alerts.filter((a) => a.kind === 'price_drop' && (a.createdAt ?? '') >= since);
  const best = listings
    .filter((l) => l.status !== 'dismissed' && l.status !== 'gone')
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  // Skip a no-news day for a search rather than writing an empty digest.
  if (!fresh.length && !recentDrops.length) continue;

  // Compose a two-to-four-line md body: what's new, any drops on the shortlist,
  // the best current option (cite its score), and — where you can see it from the
  // listings' true costs vs the search budget — a one-line market read. Every
  // claim traces to a row you just read; never invent a number.
  const body = [
    `${fresh.length} new listing(s), ${strongNew} strong (80+).`,
    recentDrops.length ? `${recentDrops.length} price drop(s) in the last day.` : '',
    best ? `Best current option: "${best.title}" (${best.score}).` : '',
  ].filter(Boolean).join('\n');

  db.insert('alerts', {
    searchId: search.id,
    listingId: best ? best.id : undefined,
    kind: 'digest',
    title: `Daily digest — ${search.title}`,
    body,
  });
}
```

Guardrails: one digest row per active search per run; skip searches with no movement; every figure
is read from a row, never estimated; keep the body to a few lines — the point is a glance, not a
report. The `alerts` insert here targets `alerts`, never `listings`, so it never re-fires the
enrichment pipeline; `notify-on-alert` delivers it out-of-app if a channel is configured.

## Action: review

Invoked by the concierge (or directly) with `input.searchId` and an optional `input.ids` of the
listings to weigh — default to every `status='shortlisted'` listing for the search. This is genuine
cross-item reasoning, not per-listing scoring: read the set, then reason over the whole.

```ts
const search = db.query('searches', { where: { id: searchId } })[0];
let listings = db.query('listings', { where: { searchId } }).filter((l) => l.status === 'shortlisted');
if (ids?.length) listings = listings.filter((l) => ids.includes(l.id));
const notes = db.query('taste_notes', { where: { searchId } });
// For each, pull its commutes + analyses to ground the verdict in evidence.
```

Produce a short prose verdict the caller renders inline: the trade-offs between them, what they have
in common (revealing an implicit taste worth confirming), any two that are near-duplicates of the
same decision, and a recommended viewing order — each claim tied to the listing's own evidence and
the search's stated priorities. This action **writes nothing**; it returns the verdict text. Weigh
against the taste model but never silently re-score here (that's `rank`/`learn`).
