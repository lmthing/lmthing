# Scoring and explanations

## The score is deterministic arithmetic over the ranker's inputs

`blendScore` itself does no judgment — it takes a base of 60 and applies a fixed set of deltas
(taste-note contributions, commute overage penalties, flag penalties, budget overage penalty, and a
hard-constraint cap) that the RANKER computes and hands in. This split matters: the model's job is to
map a listing's evidence onto each `noteMatches` entry (how well does this listing actually support or
contradict this note's statement — a −1..1 judgment call) and compute `commuteOverBy` from real
`commutes` rows; `blendScore`'s job is just to turn those honest inputs into a reproducible number.
Never skip the evidence-mapping step and hand in placeholder matches just to get a score out — a
score with no real mapping behind it is not meaningfully different from a random number.

## `scoreSummary` must name names

`blendScore`'s own component labels (`"light note"`, `"commute over max"`) are generic by design —
the ranker's job in `scoreSummary` is to make each one concrete: which note, citing its actual
statement and weight ("+ bright corner unit [light note w0.8]"); which commute target and by how much
("− 41 min to office vs 30 max"); which flag ("− size_overstated"). A `scoreSummary` that just restates
the numbers without naming the underlying evidence defeats the entire point of keeping the taste model
inspectable — the user should be able to read it and understand exactly why THIS listing scored what
it did, without having to cross-reference the notes table themselves.

## The hard-constraint cap is absolute, not a strong penalty

When `violatesHardConstraint` is true, `blendScore` caps the result at 45 regardless of how well
everything else lines up — this is deliberate, not a rounding quirk: a listing that fails a stated
must-have or a dealbreaker-weight note should never surface as a top match, no matter how good its
true cost or commute numbers look. When writing `scoreSummary` for a capped listing, say so explicitly
("capped at 45 — no elevator, and this search requires one") rather than letting the cap look like an
unexplained low score.
