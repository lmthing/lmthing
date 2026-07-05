---
input: {}
---

Scan the pantry for ingredients at risk — out of stock, expiring within three days, or notably more
expensive than everything else on hand — and suggest a diet-aware substitute for each newly
at-risk one, skipping anything already flagged. Invoked by `hooks/nightly-substitutions.ts` on a
nightly cron with **no structured input**; both tasks self-query rather than trusting anything
passed in.
