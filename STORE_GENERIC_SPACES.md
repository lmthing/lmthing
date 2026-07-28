# Store idea: generic, schema-agnostic spaces — a third catalog tier

*Companion to `FEATURE_IDEAS.md`, same branch. The store today has exactly two SKU types:
full project-app templates (`store/projects/*`) and provider integrations
(`store/spaces/integration-*`). This proposes a third: **utility spaces** — horizontal capability
bundles that install into any project and work against whatever schema they find. Sizes: S = days,
M = weeks.*

---

## Why the runtime already supports this (the pluggability contract)

Five mechanisms, all shipped, make schema-agnostic spaces first-class rather than a hack:

1. **Deferred table narrowing.** A `db:*` grant with no `{ tables: [...] }` on a project-agnostic
   space explicitly **defers** the table check to the project the space resolves into
   (`sdk/org/libs/core/src/spaces/capabilities.ts:150-160` — a bare cap with
   `knownTables === undefined` validates later, per-project). The capability system was built for
   this.
2. **Schema discovery.** `db.tables()` lists the live schema (not per-table narrowed by design,
   `app-globals.ts:141-142`), any `db:*` grant earns `listProjectDir`/`readProjectFile`
   introspection (`app-globals.ts:230-233`), and the ambient DTS types the project's actual tables
   — so a generic agent *sees* the schema it landed in, at typecheck time.
3. **Free reactivity.** Every committed db write auto-emits a synthetic
   `project/db.<table>.<insert|update|remove>` event whose payload is the row, with **no emitter
   def required** (`sdk/org/libs/cli/src/app/hooks/runtime.ts#onDbWrite`) — a utility space can
   react to any app's data changes. Depth cap (3), coalescing, and self-write exclusion already
   bound the loops.
4. **Per-install configuration.** The `lmthing` block in a space's `package.json` carries a
   `settings` JSON schema that the Integrations tab already renders (the integration spaces prove
   it), and `POST /api/store/spaces/install { spaceId, projectId? }` installs per-project — so one
   catalog entry binds differently in each app.
5. **Composability via curated events.** A utility space can re-emit curated, typed events
   (db/cron/internal emitter defs) that *other* installed spaces consume — the catalog manifest
   already lifts `events`/`functions` so the finder can match them.

**The design rule for every space below:** no hardcoded table or column names. Each ships a
`bind` tasklist that runs once at install: introspect `db.tables()`, ask the user (or infer) which
tables/columns to attach to, and persist the binding in its own config table or space knowledge.
That one convention is what makes a single catalog entry work in `health`, `trips`, `kitchen`,
`homes`, and `blog` alike.

---

## The catalog — twelve utility spaces

Each entry: what it does, its capability ceiling (least privilege), how it stays generic, and which
of the six shipped apps prove pluggability.

### 1. `insights` — the analyst (M) ★
Ask-my-data plus a weekly digest: natural-language questions over any project's tables, rendered as
chart/table components; a cron emitter (`digest.due`) produces a periodic summary of what changed
and what stands out.
- **Caps:** `db:read` only.
- **Generic how:** schema from `db.tables()`; the agent writes ad-hoc queries — code-as-interface
  means no query-builder DSL is needed. Chart components are typed over `rows`, not domains.
- **Plugs into:** health (symptom trends), trips (spend by leg), kitchen (most-cooked recipes),
  blog (post performance), homes (viewings funnel). Five-for-five.
- Emits `insight.found { title, severity, summary }` for the dispatcher (#8) to route.

### 2. `janitor` — data hygiene (M) ★
Dedupe, normalize (dates, phone formats, casing), detect orphans and stale rows. Never mutates
directly: writes findings to its own `janitor_findings` review queue; the user approves batches;
an apply step executes approved fixes.
- **Caps:** `db:read`, `db:write` (bare — deferred narrowing).
- **Generic how:** heuristics over column *types and names* (email-like, date-like, fk-like), not
  domain knowledge. The propose-then-apply queue reuses the pattern THING's
  `resolve_flagged_figure` tasklist already established.
- **Plugs into:** every app; machine-built apps accumulate exactly this kind of drift.

### 3. `importer` — files in, rows out (M) ★
Drop a CSV/XLSX/ICS/JSON (or point at an upload) → a mapping wizard (`ask()` with the target
table's columns) → validated rows inserted, with a dry-run diff first.
- **Caps:** `db:read`, `db:write`; delegates parsing to `system-files` (reader/sheet already
  dispatch by mediaType).
- **Generic how:** the mapping step *is* the genericity — source columns to target columns, typed
  by the project DTS. Export is the same map reversed.
- **Plugs into:** kitchen (recipe CSVs), trips (bank-export reconciliation), health (lab-result
  sheets), homes (listing exports), blog (content migration).

### 4. `deadlines` — the date watcher (M) ★
Finds date/datetime columns across the schema, lets the user arm watchers ("warn me 14 days before
any `expiry_date` in `documents`"), and a cron emitter sweeps and emits
`deadline.approaching { table, rowId, column, dueAt, label }`.
- **Caps:** `db:read` + a cron emitter (cron defs already get persisted `state` for cursors).
- **Generic how:** column discovery by type; the watcher config lives in its own table. Delivery is
  *not* its job — it emits, the dispatcher (#8) or a future `notify()` delivers.
- **Plugs into:** trips (bookings), health (prescription refills, appointments), homes (offer
  deadlines), kitchen (use-by dates), blog (scheduled posts).

### 5. `intake` — universal inbox to rows (M)
A named inbound endpoint (webhook or inbound email) per binding; each arriving payload is triaged
by an agent into a target table, with unparseable items going to a review queue.
- **Caps:** `db:write`, webhook emitter (`header-equals` verify — data-only, safe to ship from the
  store).
- **Generic how:** the triage agent maps free-form payloads onto the bound table's DTS; the same
  space serves "email a receipt to trips" and "webhook new leads into homes".
- **Plugs into:** homes (lead capture), trips (booking confirmations), health (device pings),
  blog (reader replies).

### 6. `ledger` — money overlay (M)
Attaches to any (amount, date[, category]) column pair; provides budgets, rolling totals,
anomaly flags (`spend.spiking`), and a monthly close summary.
- **Caps:** `db:read`; optionally `db:write` for its own budgets table.
- **Generic how:** binds to columns, not tables — trips' `expenses`, kitchen's `grocery_orders`,
  homes' `costs` are all the same shape to it. This is the `.issues/derived-balance-*` lesson
  productized: obligations and totals get a dedicated, principled treatment.
- **Plugs into:** trips, kitchen, homes, health (out-of-pocket costs).

### 7. `auditor` — change log + what-changed (S/M)
Subscribes to the synthetic db events for bound tables, keeps an append-only `audit_log` (actor,
before/after, session), answers "what changed this week?", and drafts revert statements for the
user to approve.
- **Caps:** `db:read`, `db:write` (own table); event hooks with `handler:` (no LLM cost per write —
  the deterministic-handler path exists precisely for this).
- **Generic how:** the synthetic events carry `{table, event, row}` — nothing domain-specific.
  Note: `update`/`remove` currently notify without a before-image (`WriteListener` asymmetry, see
  CODEBASE_REVIEW.md) — the auditor is the concrete consumer that justifies fixing that.
- **Plugs into:** everything; it's also the trust substrate the review flagged as missing (Undo).

### 8. `dispatcher` — event → messenger router (S/M) ★
A rules table ("`deadline.approaching` → Telegram me", "`insight.found` severity ≥ high → Slack
#alerts") that bridges *any* project/space event to whichever messenger integrations are
installed.
- **Caps:** event hooks + calls into the installed integrations' send functions.
- **Generic how:** it routes addresses, not domains. This is the userland stopgap for the missing
  `notify()` global (FEATURE_IDEAS.md "Reachback") — and stays useful after Reachback ships as the
  rules layer on top of it.
- **Plugs into:** every space on this list emits; every messenger integration delivers. The
  composability keystone.

### 9. `enricher` — fill in the blanks (M)
Select a table + empty-ish columns → per-row research (delegating to `system-research` /
`webSearch`) proposes values with sources; approved batches are written back.
- **Caps:** `db:read`, `db:write`; research via delegation (the granted-only
  `webSearch`/`webFetch` universals stay behind the space's own grant).
- **Generic how:** "row + column names + existing values" is the whole prompt contract.
- **Plugs into:** homes (listing details), trips (opening hours, visa rules), kitchen (nutrition
  per ingredient), blog (source links).

### 10. `validator` — data contracts (M)
Per-table rules (required fields, ranges, referential checks, custom predicates) enforced
reactively: a deterministic handler on the synthetic db events flags violations into a review
queue; a page shows table health.
- **Caps:** `db:read`, `db:write` (own tables), event hooks (`handler:` — cheap, no LLM per
  write).
- **Generic how:** rules are data; the checker is generic. This gives machine-built apps the
  ongoing correctness gate that `check_acceptance` only provides at build time.
- **Plugs into:** everything — it's the immune system for automator-grown schemas.

### 11. `planner` — calendar overlay (M)
A generic calendar/agenda page over every bound date column (one config, many tables), with an
agent that answers "what does next week look like?" across all of them and can move things.
- **Caps:** `db:read`, `db:write`, `pages:write` (one generic page component).
- **Generic how:** same column-binding as `deadlines` (natural bundle partner); the page renders
  `{date, label, table, rowId}` tuples, nothing else.
- **Plugs into:** trips + health + kitchen + homes simultaneously — its real pitch is the
  *cross-app* agenda on one pod.

### 12. `archivist` — retention, snapshots, PII (M)
Scheduled table snapshots to documents (`.sql`/CSV), retention policies ("purge raw webhook
payloads after 90 days"), and a PII scan report over tables + documents.
- **Caps:** `db:read`, `db:write`, cron emitter.
- **Generic how:** policies are data over discovered schema; the PII scan is pattern-based.
- **Plugs into:** health (obviously), intake/inbox payload hygiene everywhere; pairs with the
  backup flow rather than replacing it.

---

## Store-side changes to carry the tier (S, one pass)

- **`kind: "utility"`** in the `lmthing` package block (today the integrations use
  `kind: "integration"`), plus category tags — the manifest generator and `CatalogSpace` need no
  structural change, and the store SPA's stub `/category/$categoryId` route becomes real for free.
- **The finder already fit-checks catalog entries** against "when X do Z" needs via the lifted
  `events`/`functions` surface — utility spaces should declare their curated events richly
  (`deadline.approaching`, `insight.found`, `validation.failed`, `import.completed`) precisely so
  the finder can compose them: "warn me before my documents expire" resolves to
  `deadlines` + `dispatcher` with zero new code.
- **A `bind` convention page in `org/docs/format/space/`** documenting the introspect→ask→persist
  setup tasklist pattern, so third-party utility spaces (post-`/publish`) follow the same shape.

## Sequencing

Start with the composability spine: **`dispatcher` (#8) + `deadlines` (#4) + `insights` (#1)** —
three spaces that together demo the whole thesis ("my apps watch themselves and tell me where I
am"), each S/M, each five-for-five pluggable across the shipped apps. `auditor` (#7) and
`validator` (#10) follow as the trust layer; `importer`/`intake` as the data-in layer; the rest as
catalog depth. Every one of them also compounds the FEATURE_IDEAS.md keystones: they all emit into
Reachback when it ships, and the Automation Weaver can wire them instead of authoring hooks from
scratch.
