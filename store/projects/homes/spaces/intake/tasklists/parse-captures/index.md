---
input: {}
---

Parse every pending capture end to end: scan for `raw_captures` still `pending`, segment each into
candidate listings and extract/dedupe/merge them into canonical `listings` rows, then write each
capture's final summary. The clipper self-scans — no input is required beyond what's already in the
database, so this tasklist runs identically whether it was triggered by a single fresh paste (the
`parse-new-capture` hook) or invoked directly to sweep up stragglers.
