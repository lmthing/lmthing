# Dedupe

## Notes — dedupe by topic

Before writing a `knowledge_notes` row, check existing notes for one with a matching (or clearly
equivalent) `topic` or `analyte`. If one already exists:

- If the existing note is still accurate and the new research doesn't add anything materially new,
  write nothing — a second, near-identical note is clutter, not knowledge.
- If the new research meaningfully deepens or updates what's known, prefer treating this as an
  update to the existing note's `body` over inserting a second row for the same topic. The schema
  has no explicit "supersedes" link, so use judgment: the goal is one authoritative note per topic,
  not a growing pile of similar ones.

Matching "equivalent" topics takes some judgment — "elevated LDL" and "high LDL cholesterol" are the
same topic in different words; don't rely on exact string equality alone.

## Sources — dedupe by value

`sources.value` is the actual dedupe key (a domain, a guideline name, or a saved query) and is
`unique` at the schema level, so a naive insert of an already-known source will fail outright.
Always check `db.query('sources', {})` for a matching `value` first. If one exists and the new
information only refines its `label` or `trust`, use `db.update` instead of trying to insert a
second row for the same source.
