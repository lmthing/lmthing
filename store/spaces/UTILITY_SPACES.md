# The utility tier — schema-agnostic spaces

A third catalog kind alongside project-app templates (`store/projects/*`) and provider
integrations (`store/spaces/integration-*`). A **utility space** installs into *any* project and
binds to whatever tables it finds — it hardcodes no host table or column names.

Authoring contract: [`UTILITY_SPACE_CONTRACT.md`](./UTILITY_SPACE_CONTRACT.md).
Reference implementation: [`utility-deadlines/`](./utility-deadlines/).

## What ships

| Space | Does | Own tables | Hook |
|---|---|---|---|
| 🧹 `utility-janitor` | Dedupe, normalization and orphan findings via a propose→approve→apply queue | `janitor_findings` | daily 06:00 |
| ✅ `utility-validator` | Data contracts (required/range/regex/enum/reference) checked daily, with auto-resolve | `validation_rules`, `validation_violations` | daily 06:30 |
| ⏰ `utility-deadlines` | Watches date columns, records approaching deadlines | `deadline_watchers`, `deadline_alerts` | daily 07:00 |
| 💰 `utility-ledger` | Money overlay on (amount, date, category) columns; monthly closes and budget flags | `ledger_bindings`, `ledger_budgets`, `ledger_reports` | daily 07:30 (1st-of-month gate) |
| 📊 `utility-insights` | Weekly digest + ask-my-data over any schema | `insight_reports` | daily 08:00 (Monday gate) |
| 📮 `utility-dispatcher` | Routes every other space's queue rows to your messaging channel | `dispatch_rules`, `dispatch_log` | daily 08:30 |
| 📜 `utility-auditor` | Snapshot-diff change log with draft-only reverts | `audit_bindings`, `audit_snapshots`, `audit_log` | daily 05:45 |
| 📬 `utility-intake` | Universal inbox: rules route arriving payloads into real tables | `intake_items`, `intake_rules` | on `intake_items` insert |
| 🗓️ `utility-planner` | One cross-table agenda over bound date columns | `planner_bindings` | none (on demand) |
| 📥 `utility-importer` | CSV/JSON → mapped, dry-run, deduped rows | `import_jobs` | none (never unattended) |
| 🔍 `utility-enricher` | Researches blank cells and fills them only after you approve the sourced value | `enrich_tasks` | none (research spends budget) |
| 🗄️ `utility-archivist` | Weekly snapshots, retention *candidates*, and a PII scan — never deletes | `archive_policies`, `archive_snapshots`, `archive_reports` | daily 05:30 (Sunday gate) |

## How they compose

Every space records what it finds as rows in a **queue table**. Each insert auto-emits the
synthetic `project/db.<table>.insert` event, so anything can subscribe with no custom event
machinery. `utility-dispatcher` is the built-in consumer: it holds a registry of the queue tables
above, watermarks each one per rule, and delivers a verbatim digest to a messaging integration the
user configured and confirmed with a test delivery.

```
utility-* space  ──writes──▶  its queue table  ──synthetic insert event──▶  utility-dispatcher  ──delegate──▶  integration-*/agent
```

## The shared design rules

Every space in this tier follows the same discipline (details in the contract):

- **Bind, don't assume.** A `bind` tasklist introspects `db.tables()`, samples real rows, scores
  candidates with a pure function, and persists the binding — high confidence `active`, the rest
  `proposed` for a human to confirm.
- **Deferred capability narrowing.** A bare `db:*` grant on a project-agnostic space defers table
  validation to the project it installs into; own tables get an explicitly narrowed `db:schema`.
- **Determinism first.** Parsing, classification, window math, dedupe keys, digests and diffs are
  pure, self-contained, unit-tested functions. Tasklist nodes narrow `role`, `capabilities` and
  `functions` per step, so a planning node structurally cannot write.
- **Propose, then apply.** Anything destructive or judgment-heavy lands in a review queue first.
  Nothing in this tier hard-deletes: "delete" is a status update.
- **Honest reporting.** Goal nodes report upstream numbers only, and zero findings is a success.

## Tests

```bash
pnpm -C store test:spaces        # node --test over spaces/**/tests/
```
