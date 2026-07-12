# `db` — agent-side data access

The `db` global is the agent's window onto its project's SQLite database. It is the one **synchronous** data global in the sandbox (an `execShell`-class host call, not a value-yield) `sdk/org/libs/core/src/db/types.ts:46-55`, and it is assembled per-agent: only the verbs the agent's `capabilities:` frontmatter granted exist on the object, and every call is re-checked against the grant's table list host-side `sdk/org/libs/core/src/exec/app-globals.ts:113-160`.

- Schema authoring format (`database/<table>.json`) → [../format/project/database/README.md](../format/project/database/README.md)
- Declaring `db:read` / `db:write` / `db:schema` → [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md)
- The served app that shares this database → [../app/features.md](../app/features.md)

---

## When `db` exists at all

Three conditions must ALL hold, or the `db` name is never bound on `globalThis` `sdk/org/libs/core/src/exec/app-globals.ts:189-195`:

1. the session/fork/delegate has a `projectRoot` (a project-rooted session — a bare THING session outside a project gets no `db`),
2. the host supplied a `db` impl (`AppGlobalImpls.db`, `sdk/org/libs/core/src/exec/app-globals.ts:30-32`), and
3. the agent holds at least one of `db:read` / `db:write` / `db:schema`.

The pod supplies the impl from the project's booted SQLite handle — `db: db.db` in `getProjectAppGlobals` `sdk/org/libs/cli/src/server/session-manager.ts:559,612`, where `db` is the `ProjectDb` returned by `bootProjectApp` `sdk/org/libs/cli/src/app/boot.ts:67`. A project with no `database/*.json` boots **no db at all** (`bootProjectApp` returns `null`), so a grant alone is not enough.

`db` is not declared in `COMMON_DTS`; its declaration is composed from the same grant that drives injection `sdk/org/libs/core/src/typecheck/library-dts.ts:142-156`, so a stray `db.query(...)` in an agent with no db capability fails **typecheck** ("Cannot find name 'db'"), not at runtime.

---

## The method surface, per verb

`buildScopedDb` puts exactly the granted members on the object `sdk/org/libs/core/src/exec/app-globals.ts:120-160`, and `composeDbDts` emits exactly the matching declarations `sdk/org/libs/core/src/typecheck/library-dts.ts:129-156`. The two read the same `AppCapabilities` value, so they cannot drift.

| Capability | Members injected | DTS fragment |
|---|---|---|
| `db:read` | `query(table, opts?)`, `tables()` | `DB_READ_MEMBERS` `library-dts.ts:130-131` |
| `db:write` | `insert(table, values)`, `update(table, {where,set})`, `remove(table, {where})` | `DB_WRITE_MEMBERS` `library-dts.ts:134-136` |
| `db:schema` | `createTable(schema)`, `addColumn(table, name, column)` | `DB_SCHEMA_MEMBERS` `library-dts.ts:139-140` |

`db:schema` additionally earns two standalone (non-`db`) globals: `writeTableSchema` (writes a **catalog** template) and `writeProjectTable` (writes `<projectRoot>/database/<name>.json` into the LIVE project and re-derives its db) `sdk/org/libs/core/src/exec/bootstrap.ts:286-291`. See [app-authoring.md](./app-authoring.md).

The declared signatures (verbatim from `DB_READ_MEMBERS` / `DB_WRITE_MEMBERS` / `DB_SCHEMA_MEMBERS`, `sdk/org/libs/core/src/typecheck/library-dts.ts:129-140`):

```ts
declare const db: {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): any[];
  tables(): string[];
  insert(table: string, values: Record<string, unknown> | Record<string, unknown>[]): any;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): number;
  remove(table: string, opts: { where: Record<string, unknown> }): number;
  createTable(schema: any): void;
  addColumn(table: string, name: string, column: any): void;
};
```

Rows come back typed `any[]` by convention, so `row.field` reads without a cast.

---

## `query` — the equality-only `where`

There is **no operator language**. `where` is a flat equality map: each key/value pair becomes `col = ?`, AND-joined; a `null` value becomes `col IS NULL` (and binds nothing) `sdk/org/libs/cli/src/app/store.ts:387-404`. No `>`, `<`, `LIKE`, `IN`, or `OR` exists at this layer — the agent filters the rest in memory, or the project exposes an `api/` endpoint that runs the real SQL (see [../format/project/api/README.md](../format/project/api/README.md)).

Everything else on `QueryOpts` maps straight to SQL `sdk/org/libs/cli/src/app/store.ts:427-446`:

- `orderBy` — a column name, or `{ column, dir }` (`dir` defaults to `asc`).
- `limit` / `offset` — SQLite requires a `LIMIT` before `OFFSET`, so an `offset` with no `limit` emits `LIMIT -1` first `store.ts:436-440`.
- `include` — see below.

A real example, from the `blog` app's `fetcher` agent `store/projects/blog/spaces/newsroom/agents/fetcher/instruct.md:43-44`:

```ts
const source = db.query('sources', { where: { id: sourceId } })[0];
const known = new Set(db.query('raw_items').map(r => r.url));
```

Values are **marshalled at the boundary**, so the agent sees JS scalars rather than SQLite storage types: `boolean` columns come back `true`/`false` (not `0`/`1`), `json` columns come back parsed, `date` columns come back as ISO-8601 strings `sdk/org/libs/cli/src/app/store.ts:146-163`. Marshalling needs the declared column types, which is why the pod passes the loaded `database/*.json` schemas into `openProjectDb` `sdk/org/libs/cli/src/app/boot.ts:67`; without them `boolean`/`json`/`date` degrade to their storage form `sdk/org/libs/cli/src/app/store.ts:18-25`.

### `include` — named relations, expanded inline

`include` names relations declared in the table's `relations` block, not arbitrary joins `sdk/org/libs/cli/src/app/store.ts:448-477`:

- a **`belongsTo`** relation resolves to a single object (or `null` when the FK is null / the target row is missing) `store.ts:459-468`;
- a **`hasMany`** relation resolves to an array of the target rows `store.ts:469-475`.

Both are implemented as follow-up `query` calls per row, filtered on the primary key / the relation's `via` column. Two fail-loud errors: a relation name the table does not declare throws `store: table "<t>" has no relation "<r>"` `store.ts:458`, and using `include` when the schemas were not loaded throws `store: query "include" for table "<t>" requires the loaded schemas` `store.ts:451-455`.

```ts
// `articles` declares a belongsTo `topic` and a hasMany `citations`
const recent = db.query('articles', {
  where: { status: 'published' },
  include: ['topic', 'citations'],
  orderBy: { column: 'published_at', dir: 'desc' },
  limit: 10,
});
// recent[0].topic      → an object (or null)
// recent[0].citations  → an array
```

---

## `insert` / `update` / `remove`

- **`insert(table, values)`** takes one row or an array. Columns missing from the input are filled from the schema: `generated: 'uuid'` → a fresh UUID, `generated: 'now'` → an ISO timestamp, otherwise the column's `default` `sdk/org/libs/cli/src/app/store.ts:353-366`. It returns the inserted row(s) via `RETURNING *`, marshalled back to JS values; a batch runs inside one transaction and returns an array, a single row returns a single row `store.ts:368-385`.
- **`update(table, {where, set})`** returns the number of rows changed. An empty `set` is a no-op returning `0` `store.ts:406-417`. The `where` is the same equality-only map.
- **`remove(table, {where})`** returns the number of rows deleted. Note that an **omitted or empty `where` produces no `WHERE` clause at all** `store.ts:392` — `db.remove('t', { where: {} })` deletes every row in the table.

Every committed row mutation fires the db's `onWrite` listener synchronously `sdk/org/libs/cli/src/app/store.ts:536-562`, which is what turns a write into the synthetic `project/db.<table>.<insert|update|remove>` event consumed by event hooks. `insert` carries the inserted rows on that event; `update`/`remove` carry an empty `rows` array (the affected rows are not re-queried) `store.ts:55-58,550-559`. See [events-and-integrations.md](./events-and-integrations.md).

---

## `createTable` / `addColumn`

`db:schema` is live DDL against the running database:

- **`createTable(schema)`** takes the full `TableSchema` and **no name argument** — the table name is derived by slugifying `schema.title` (lowercased, non-alphanumerics → `_`) `sdk/org/libs/cli/src/app/store.ts:481-488,251-259`. This is a different contract from `writeProjectTable(name, schema)`, which takes an explicit name and persists `database/<name>.json`. `createTable` mutates the live db only; it does **not** write the JSON schema file, so a table created this way does not survive a schema re-derive from disk unless the file is also written.
- **`addColumn(table, name, column)`** runs `ALTER TABLE … ADD COLUMN` and updates the in-memory type registry so subsequent marshalling knows the new column's type `store.ts:490-495`.

---

## Per-table narrowing (`assertTableAllowed`)

A `db:*` grant may carry a `{ tables: [...] }` config; an omitted `tables` means all tables `sdk/org/libs/core/src/spaces/capabilities.ts:76-94`. The config is parsed fail-loud: `tables` is the only allowed key, it must be a list of strings, and — when the resolving project's table set is known — every named table must actually exist in `database/` `sdk/org/libs/core/src/spaces/capabilities.ts:124-163`.

```yaml
# store/projects/blog/spaces/newsroom/agents/fetcher/instruct.md:15-17
capabilities:
  - db:read:  { tables: [sources, raw_items] }
  - db:write: { tables: [raw_items, sources] }
```

The narrowing is **not** a DTS convenience — it is re-checked host-side on **every call**, not just at injection `sdk/org/libs/core/src/exec/app-globals.ts:16-19,102-111`:

```ts
function assertTableAllowed(verb, grant, table) {
  if (!grant) throw new Error(`db ${verb}: not permitted (capability not granted)`);
  if (grant.tables && !grant.tables.includes(table)) {
    throw new Error(`db ${verb}: table "${table}" not permitted; allowed tables: ${grant.tables.join(', ')}`);
  }
}
```

Which methods are table-checked `sdk/org/libs/core/src/exec/app-globals.ts:126-158`:

| Method | Table-checked? |
|---|---|
| `query` | yes — against the `db:read` grant `app-globals.ts:127-130` |
| `insert` / `update` / `remove` | yes — against the `db:write` grant `app-globals.ts:135-146` |
| `addColumn` | yes — against the `db:schema` grant `app-globals.ts:154-157` |
| `tables()` | **no** — it lists schema, not row data, so there is no per-table narrowing `app-globals.ts:131-132` |
| `createTable(schema)` | **no** — no `assertTableAllowed` call is made `app-globals.ts:151-153` |

> The `createTable` gap is worth naming explicitly: the code comment at `sdk/org/libs/core/src/exec/app-globals.ts:149-150` says "the grant's table list (if any) pre-authorizes which tables may be created", but the implementation calls `db.createTable(tableSchema)` directly with no check. An agent holding `db:schema: { tables: [a] }` can therefore create a table named anything. `addColumn` on an existing out-of-grant table IS blocked, and `db:read`/`db:write` narrowing on the new table still applies to any subsequent read/write — but the DDL itself is unnarrowed today.

The DTS gives one more layer of narrowing for free: because a verb the agent lacks is simply **absent** from `composeDbDts`'s member list, a stray `db.insert(...)` in a read-only agent fails typecheck rather than reaching the engine `sdk/org/libs/core/src/exec/app-globals.ts:116-118`.

### Read-only fork roles

`intersectAppCaps(app, allowWrite=false)` drops every mutating grant before the `CapabilityProfile` is built — of the db verbs, only `db:read` survives into an `explore`/`plan` fork; `db:write` and `db:schema` are removed `sdk/org/libs/core/src/exec/capability.ts:4-28`, so they are neither injected nor declared there.

---

## How this differs from an api handler's `ctx.db`

One schema, two typed surfaces `sdk/org/libs/core/src/db/types.ts:1-11`.

| | agent sandbox (`db`) | api handler / hook (`ctx.db`) |
|---|---|---|
| Type | `DbApi` — every method **synchronous** `db/types.ts:55-110` | `AsyncDbApi` — every method returns a `Promise` `db/types.ts:112-120` |
| Call style | `const rows = db.query('items')` | `const rows = await ctx.db.query('items')` |
| Where it runs | QuickJS sandbox; a same-process host call, no turn boundary crossed | a `worker_threads` worker; each method is a `postMessage` proxy correlated back to the main process `sdk/org/libs/cli/src/app/api/worker.ts:5-20,135-137` |
| Capability gating | per-verb + per-table, from `capabilities:` frontmatter | **none** — the handler gets the full `AsyncDbApi`; the pod is the security boundary |
| Method set | only the granted subset | all seven (`DB_METHODS`, `sdk/org/libs/cli/src/app/api/worker.ts:57-63`) |

`AsyncDbApi` is a mapped type derived from `DbApi`, so the two method sets can never drift `sdk/org/libs/core/src/db/types.ts:118-120`.

The worker is a **crash boundary, not a data path**: the handler's `ctx.db` never touches SQLite directly — every call round-trips to the main process, so every write still executes in one place `sdk/org/libs/cli/src/app/api/worker.ts:12-16`. (The main-process `ProjectDb.async` mirror is currently a thin `Promise.resolve(sync)` wrapper `sdk/org/libs/cli/src/app/store.ts:564-572`; the cross-thread proxy is the worker-side `ctx.db`.)

The practical consequence for an agent: `db.*` never ends the turn, so a read-modify-write sequence runs inside one statement batch — but `apiCall` **does** yield, so anything routed through an endpoint crosses a turn boundary. Reach for `db` for direct row work an agent is granted; reach for `apiCall` when the project has already encoded the operation (transactions, non-equality filters, validation) as an endpoint.

---

## Errors an agent will see

| Situation | Error |
|---|---|
| Verb not granted (name absent from the DTS) | typecheck: `Cannot find name 'db'` / `Property 'insert' does not exist` |
| Table outside the grant | `db db:read: table "x" not permitted; allowed tables: a, b` `app-globals.ts:108-110` |
| Grant missing entirely at call time | `db db:write: not permitted (capability not granted)` `app-globals.ts:107` |
| `include` naming an undeclared relation | `store: table "t" has no relation "r"` `store.ts:458` |
| `include` without loaded schemas | `store: query "include" for table "t" requires the loaded schemas — pass { schemas } to openProjectDb` `store.ts:451-455` |
| Table has no primary key (needed by `include`) | `store: table "t" has no primary key` `store.ts:319` |

All of these surface to the model as retryable yield/host errors rather than silent `undefined`.
