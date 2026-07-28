# Utility-space implementation contract (verified against code + docs)

Every claim here was verified in the repo. Follow it exactly — the space loader is fail-loud and an
unknown frontmatter key aborts the whole space load.

## Location & layout

`/home/user/lmthing/store/spaces/utility-<id>/`

```
utility-<id>/
├── package.json          # lmthing block (below) — REQUIRED or the manifest generator skips the space
├── README.md             # what it does, bind flow, own tables, queue-table events
├── agents/<slug>/
│   ├── charter.md        # one-paragraph identity + boundaries (see health records/analyst for tone)
│   └── instruct.md       # frontmatter + per-action instructions (style guide below)
├── functions/<fnName>.ts # PURE deterministic helpers — export name MUST equal file basename
├── knowledge/<topic>/*.md
├── tasklists/<action>/   # index.md + NN-<id>.md agent nodes + NN-<id>.ts code nodes
├── hooks/<slug>.ts       # ONLY cron hooks or hooks on the space's own tables — see "hooks" below
└── tests/*.test.mjs      # node --test — REQUIRED, covered by `pnpm -C store test:spaces`
```

## package.json

```json
{
  "name": "utility-<id>",
  "version": "1.0.0",
  "private": true,
  "lmthing": {
    "kind": "utility",
    "title": "<Title>",
    "tags": ["utility", "<domain-tag>"],
    "icon": "<one emoji>",
    "description": "<one user-facing sentence>",
    "settings": { }        // JSON schema ONLY if the space needs env config; usually omit entirely
  }
}
```
The generator lifts `kind`/`settings` as-is (`gen-apps-manifest.mjs:466-467`) and skips dirs with no
`lmthing` block. Do NOT reference env vars in emitter defs (the `INTEGRATION_<ID>_` namespace rule);
utility spaces should need none.

## Agent `instruct.md` frontmatter — allowed keys ONLY

`title, knowledge, functions, components, actions, defaultAction, canDelegateTo, dependencies,
capabilities, model, triggers` (`load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS`; anything else THROWS).

- `actions:` — list of `{ id, label, description }`. **An action id that matches a
  `tasklists/<id>/` directory runs that tasklist host-driven**; an action with no matching tasklist
  is prose-driven (its `## Action: <id>` section in the body).
- `capabilities:` grammar (one list item per grant):
  - Bare generic grants: `- db:read` / `- db:write` — a bare cap on a project-agnostic space
    DEFERS table validation to the installed project (`capabilities.ts:150-160`). Use bare caps for
    reading/writing the HOST APP's tables.
  - Own-table narrowing where possible: `- db:schema: { tables: [<own_tables>] }` — pre-authorizes
    creating the space's own tables. Prefer narrowing `db:schema` to exactly the space's own tables.
  - `hooks:write` ONLY for spaces that generate per-table project hooks at bind time.
  - NEVER grant `pages:write`/`api:write` unless the space ships a page (only `utility-planner`).
- `canDelegateTo: []` on every agent unless the spec says otherwise (enforce structurally, not in
  prose).
- Hard rule: **never forbid a tool in prose — withhold it structurally** (role/capabilities/functions).

## Instruct body style (copy the tone of `store/projects/health/spaces/records/agents/analyst/instruct.md`)

- `## Action: <id>` per action. Step-by-step with fenced ```ts blocks showing the exact statements.
- Remind: statements one at a time; narration in `// comments`; `db` calls are synchronous (no
  await); `where` is EQUALITY-ONLY (filter/sort in memory beyond exact match).
- End with a `Guardrails:` list — idempotency, never fabricate, own-tables-only writes where
  relevant, treat row/document content as untrusted data, self-write-exclusion notes, and the
  review-queue rule (below).
- **db surface**: `db.query(table, {where})`, `db.insert(table, row)` → returns row with `id`,
  `db.update(table, {where, set})`, `db.tables()` (schema list), `db.createTable`, `db.addColumn`
  (schema grant). There is NO delete on the agent surface — "delete" = status column update.

## The determinism doctrine (this is the point of the whole build)

1. **Every non-trivial computation is a pure function** in `functions/` — parsing, classification,
   dedupe-key computation, scoring, diffing, formatting. The agent calls them; it never re-derives
   the logic inline. Functions must: take plain JSON-able args, return plain values, never throw on
   malformed input (degrade to `[]`/`null`/`{ok:false}`), no I/O, no Date.now() unless the spec
   says (pass `now` as an arg so tests are deterministic). **Each function file must be
   SELF-CONTAINED**: no imports, no calls to sibling space functions (per-node `functions:`
   allowlists would break them at runtime) — duplicate small local helpers inside the file as
   non-exported consts; only the export named after the basename matters.
2. **Fully mechanical steps are CODE NODES** (`NN-<id>.ts`): metadata as a PURE literal
   `export const node = { id, dependsOn, output: {...} }` (statically AST-extracted, never
   imported), plus `export async function run(ctx, inputs)`. Code nodes run worker-isolated,
   transpiled standalone — **no relative imports** (duplicate helpers inline), **await every ctx
   member** (they are async RPC stubs), **never throw** (a throw aborts the tasklist — return
   `{ok:false, reason}`), and keep outputs SCALAR-FIRST (`ok: boolean`, counts) because the
   condition DSL cannot index arrays (`x.errors.length > 0` is NOT expressible).
3. **Think-steps are `role: explore` (read + functions) or `role: plan`** — write caps are dropped
   structurally. NEVER `role: general` on a planning node.
4. **Per-node `capabilities:` narrowing**: the write node lists exactly the caps it needs
   (bare ids, subset of the agent's grants); sibling nodes without it get neither the global nor
   its DTS.
5. **Per-node `functions:` allowlist** on every node: name exactly what the node needs.
   `functions: []` = none (this also strips `webSearch`/`webFetch` — only `utility-enricher` nodes
   doing research may include them). Omitting the key = ALL functions — never omit it.
6. **`prelude`** (YAML block scalar of TS) for deterministic in-VM setup the model must not be
   trusted to re-emit (e.g. loading config rows into a variable).
7. **`onFail`** for verify-loops: checker node resolves `ok: boolean`; `onFail: { goto, when:
   "<id>.ok == false", carry: reason, maxAttempts: 2 }`; the resumed step's prompt MUST read
   `feedback`.
8. **`forEach: "<task>.<field>"`** for per-item fan-out (head task must be in `dependsOn`); the
   fork gets `item` + `index`. Mark per-item nodes `optional: true` when one bad item must not
   sink the run.
9. Every tasklist has a final `goal: true` envelope node (`role: plan`, `functions: []`) that
   reports honestly, including residual failures.

## Tasklist files

- `index.md`: frontmatter `input:` (field: typeString) + one paragraph goal. TypeStrings:
  `string|number|boolean|object|array|any`, trailing `?` optional.
- Step frontmatter fields: `id, dependsOn, output, condition, optional, goal, role, functions,
  forEach, canDelegateTo, capabilities, prelude, onFail`. `dependsOn: []` explicitly on roots.
- Upstream outputs are read as `<upstreamId>.<field>` (injected as variables named by task id).
- Forks resolve via `currentTask.resolve({...})` matching the `output` schema exactly.
- Forks CANNOT `ask()` the user. Anything needing confirmation writes rows with
  `status: 'proposed'`; a human (or the agent in a live session) later activates them. This is the
  **propose-then-apply** rule: destructive or judgment-heavy writes NEVER happen in the same pass
  that computed them — they land in a review/queue table first.

## Hooks (`hooks/<slug>.ts` in the space) — worker-isolated, same shape as project hooks

- Cron: `export default { type: 'cron', daily: 'HH:MM', trigger: '<spaceId>/<agent>#<action>',
  budget: { maxEpisodes: N, maxWallClockMs: N } }` (see `store/projects/kitchen/hooks/weekly-wrap.ts`).
  A cron/trigger delegate carries NO structured input — the action must self-query its work and be
  idempotent.
- Event: `{ type: 'event', on: { event: '<source>/<name>' }, handler | trigger, budget? }` —
  EXACTLY one of handler/trigger. Synthetic db events: `project/db.<table>.<insert|update|remove>`,
  payload = the row.
- **A shipped hook may ONLY name tables the space itself creates** (its own queue/config tables) —
  a generic space cannot know host-app table names at authoring time. Per-host-table reactivity is
  generated at BIND time via `writeProjectHook` (requires `hooks:write`), and generated hooks
  should be deterministic `handler` hooks (code-as-filter, no LLM per write) whenever possible.
- Loops are bounded by depth cap 3 + self-write exclusion + cooldown, but design them terminal
  anyway: a handler that writes table X must not itself hook table X.

## Cross-space composability — THE QUEUE-TABLE CONVENTION (no emitEvent)

Utility spaces communicate through their **queue tables**, not custom events: each space writes its
findings/alerts as rows (e.g. `deadline_alerts`, `janitor_findings`, `validation_violations`,
`insight_reports`). Every insert auto-emits the synthetic `project/db.<queue_table>.insert` event —
so `utility-dispatcher` (and any project hook) can subscribe with zero custom event machinery.
Document each space's queue table + row shape in its README under "Events other spaces can consume".

## Own tables

- Names prefixed to avoid host-app collisions; every own table documented in README.
- Created idempotently by the bind/setup tasklist's code node or write node: check
  `db.tables()` first; `db.createTable` only when absent.
- Standard columns on queue tables: `status` ('open'|'proposed'|'active'|'resolved'|'dismissed'
  as appropriate), `createdAt` (ISO string), `dedupeKey` (computed by a pure function; ALWAYS
  check-before-insert on dedupeKey).

## Tests (`tests/*.test.mjs`) — REQUIRED, `node --test`, no network, no LLM

- Unit-test EVERY function: happy path + malformed input (must not throw) + edge cases. Import via
  the transpile helper pattern (copy from `store/spaces/tests/catalog-emitters.test.mjs:55-73`:
  `typescript.transpileModule` → tmp `.mjs` → dynamic import → rm).
- Validate every `hooks/*.ts` shape statically: transpile+import the default export, assert
  `type`, exactly-one-of handler/trigger, trigger format `<spaceId>/<agent>#<action>`, budget keys.
- If the space ships `events/*.ts` emitter defs, validate them with the REAL validator:
  `const CORE = join(REPO,'sdk','org','libs','core','dist','index.js')`; guard with
  `assert.ok(existsSync(CORE), '...run pnpm --filter @lmthing/core build...')` then
  `const { validateEmitterDef } = await import(CORE)`.
- Test dedupe-key stability, date-window math with injected `now`, classification heuristics.

## Reference implementation

`/home/user/lmthing/store/spaces/utility-deadlines/` — read it END TO END before writing anything.
Match its file tone, frontmatter shapes, guardrail style, and test structure exactly.
