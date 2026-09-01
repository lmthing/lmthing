# utility-intake — the universal inbox

Anything that lands in `intake_items` gets routed into your real tables by rules you confirmed.
Webhooks, chat messages, imports, manual drops — one contract: insert a row, and it gets triaged.

The space never fetches anything itself. Sources deposit; the triager routes.

## Own tables

| Table | Purpose |
|---|---|
| `intake_items` | The inbox: `source`, `payloadJson`, `intakeKey`, `routedTable`, `routedRowId`, `status` (`pending`\|`routed`\|`unrouted`\|`discarded`), `createdAt` |
| `intake_rules` | The policy: `name`, `matcherJson`, `targetTable`, `mappingJson`, `status` (`active`\|`disabled`), `createdAt` |

## Events other spaces can consume

`intake_items` inserts auto-emit **`project/db.intake_items.insert`** — which is also what this
space's own hook listens to. `utility-dispatcher` reads the `unrouted` backlog through the same
queue-table convention, so items nobody wrote a rule for surface in a digest instead of rotting.

## Agent

`triager` — actions:

- **`triage`** (tasklist): match every `pending` item against active rules, insert the mapped row,
  mark the outcome. Fires on every arrival via `hooks/triage-on-insert.ts`; idempotent and
  burst-coalescing.
- **`rules`** (live session): build a matcher + mapping with the user, **demonstrate it against a
  real payload**, and activate only on approval.
- **`review`** (live session): walk `unrouted` items — route by hand, write a rule, or discard.

## Determinism

Matching and projection are pure functions over data: `matchIntakeRule` (AND-ed clauses, dot-paths,
malformed-never-matches, first-match-in-order), `applyIntakeMapping` (fallbacks, omit-don't-guess,
`missing` reporting), `computeIntakeKey` (inlined djb2 hash for delivery dedupe). The model never
decides *where* something goes — a reviewed rule does.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
