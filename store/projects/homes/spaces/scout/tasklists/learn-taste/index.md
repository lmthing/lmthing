---
input:
  searchId: string
---

Fold every unfolded `taste_signals` row for this search into the taste model: distill dismiss
reasons (and reinforcing saves/contacts) into cited `taste_notes`, merging into an existing
dimension's statement rather than duplicating it; mark every signal handled this pass
`folded: true`; then re-score every listing an updated note touches so the feed reflects the
refreshed model immediately, without waiting for the next unrelated `rank` pass.
