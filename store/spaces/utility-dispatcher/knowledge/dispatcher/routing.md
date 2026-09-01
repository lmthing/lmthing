# Routing — the queue registry and the watermark

## The registry

`discoverQueueTables` holds the only knowledge this space has of its siblings: for each known
utility queue table, a `space`, a human `label`, the `titleColumn` that carries the readable text,
the `detailColumns` worth showing, and a `statusFilter`.

| Table | Space | statusFilter |
|---|---|---|
| `deadline_alerts` | utility-deadlines | `open` |
| `janitor_findings` | utility-janitor | `proposed` |
| `validation_violations` | utility-validator | `open` |
| `insight_reports` | utility-insights | `open` |
| `audit_log` | utility-auditor | *(none — append-only)* |
| `archive_reports` | utility-archivist | `open` |
| `ledger_reports` | utility-ledger | `open` |
| `intake_items` | utility-intake | `unrouted` |
| `enrich_tasks` | utility-enricher | `proposed` |

An empty `statusFilter` means every row is eligible. A table absent from the project is simply not
returned — the dispatcher never assumes a sibling is installed.

## The watermark

A rule's watermark is the `lastSeenCreatedAt` of its most recent `dispatch_log` row with
`status: 'sent'`. `collectNewRows` selects rows whose `createdAt` is **strictly greater** than it —
a row created at exactly that instant was in the previous batch, so `>=` would re-send it.

Three consequences worth holding onto:

- **A rule with nothing new logs nothing.** The watermark does not move, so the next run
  reconsiders the same window and no state drifts.
- **A failed delivery does not advance the watermark** (only `'sent'` rows are read), so the batch
  is retried on the next run rather than silently lost.
- **`batchKey` = (ruleId, starting watermark, item count)** blocks a duplicate log if the same
  batch is dispatched twice within one run.

## Never

- Never send an empty digest.
- Never re-word, re-rank, filter or summarize rows beyond the recipe — `renderDigest` produces the
  message verbatim from the row values.
- Never route to a table that is not in the registry, and never invent a recipe for one.
