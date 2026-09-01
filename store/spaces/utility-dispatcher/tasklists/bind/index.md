---
input:
  trigger: string?
---

Discover which utility queue tables exist in this project and create one dispatch rule per source,
each `proposed` with an empty `channelRef` so nothing can deliver until the user configures and
tests a channel. `trigger` is not threaded into the steps — bind self-queries the schema, so a
re-run is always safe and never duplicates a rule.
