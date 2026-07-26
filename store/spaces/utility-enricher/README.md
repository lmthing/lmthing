# utility-enricher — the blank-cell researcher

A schema-agnostic space that finds the empty cells in whatever project it is installed into,
researches each one on the open web, and records what a real source **states** — with the URL that
states it. Nothing reaches your tables until you approve it.

It hardcodes **no table or column names** from the host app. You name a table and the columns you
care about (or ask "what's missing?" and get measured gaps back); the space queues research tasks,
answers them one at a time, and waits.

## The flow — propose, approve, apply

```
plan  →  research  →  review  →  apply
         (proposed)   (human)    (applied)
```

- **`plan`** (prose, live session): `findEmptyCells` over the rows you name, one deterministic
  query per cell from `buildResearchQuery`, deduped on `taskKey`. Capped at **25 new tasks per
  pass** — research spends real search and model budget, and the cap is stated out loud, never
  applied silently.
- **`research`** (tasklist): takes at most **10** `pending` tasks, oldest first; for each one
  searches, reads the best one or two results with `webFetch`, extracts the value **only when a
  source states it explicitly**, and validates it. Records `proposed` + `proposedValue` +
  `sourceUrl`, or `not-found` + `reason`. **`not-found` is a good outcome** — it is the honest
  answer, and it is free.
- **`review`** (prose, live session): every proposed value is shown together with its `sourceUrl`,
  always. Approve or reject; both are status updates only.
- **`apply`** (tasklist): the only action that writes a host table. Loads `approved` tasks only,
  re-validates each value, verifies the row still exists and the cell is **still empty**, then
  patches that single column. A cell filled in the meantime resolves `no-longer-empty` — the
  human's value always wins.

## Own tables (created idempotently by `plan`)

| Table | Purpose |
|---|---|
| `enrich_tasks` | The queue: `targetTable`, `rowId`, `column`, `query`, `proposedValue`, `sourceUrl`, `taskKey`, `status` (`pending`\|`proposed`\|`approved`\|`rejected`\|`applied`\|`not-found`), `reason`, `createdAt` |

## Events other spaces can consume (queue-table convention)

Every queued task is an insert into `enrich_tasks`, which auto-emits the synthetic event
**`project/db.enrich_tasks.insert`** (payload = the task row). Subscribe to that from a project
hook or from `utility-dispatcher` — no custom event machinery required. Status transitions
(`proposed`, `applied`) emit the corresponding `project/db.enrich_tasks.update` event.

## No hooks — on purpose

This space ships **no `hooks/` directory**, and `tests/space.test.mjs` fails if one appears.
Research costs money and wall-clock on every single task, so every pass must be initiated by the
user or by THING acting on an explicit request — never by a silent cron. Approval is a human act
for the same reason: a scheduled enricher would be a scheduled way to quietly put unverified values
into someone's database.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `findEmptyCells` (blank detection
that never mistakes `0` or `false` for empty), `buildResearchQuery` (humanize + naive singularize +
label fallback), `validateProposedValue` (per-type validation with column-name inference, run once
at proposal and again at apply), `computeEnrichKey` (stable task identity, no date — a cell is one
task forever). Tasklist nodes are role- and capability-narrowed per step; `webSearch`/`webFetch`
are listed on exactly one node, the research fan-out.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
