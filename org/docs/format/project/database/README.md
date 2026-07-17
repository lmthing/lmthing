# `database/<table>.json` — table schema

One JSON file per table, keyed by the file **basename** (`database/articles.json` → table `articles`); the table name is NOT stored inside the JSON `sdk/org/libs/core/src/db/schema.ts:93-107`. A schema file is a **declarative table definition**, not seed data — it is compiled into a real SQLite `CREATE TABLE` statement at boot `sdk/org/libs/cli/src/app/store.ts#schemaToCreateTableSql`. Written by the live-project authoring global `writeProjectTable(name, schema, rows?)` (optional third arg seeds rows), gated by the `db:schema` capability `sdk/org/libs/cli/src/app/authoring/globals.ts#writeProjectTable`. Table names are snake_case (`^[a-z][a-z0-9_]*$`), used verbatim in `CREATE TABLE <name>` `sdk/org/libs/cli/src/app/store.ts#schemaToCreateTableSql`.

## Format

```json
{
  "title": "Articles",
  "description": "A synthesized, personalized news article shown in the user's feed.",
  "columns": {
    "id":        { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":     { "type": "string",  "description": "headline shown in the feed", "required": true },
    "score":     { "type": "number",  "description": "personalization relevance rank; higher = surfaced first", "default": 0 },
    "read":      { "type": "boolean", "description": "whether the user has opened it", "default": false },
    "tags":      { "type": "json",    "description": "topic tag strings — feed filtering" },
    "createdAt": { "type": "date",    "description": "when the article entered the feed", "generated": "now" }
  },
  "relations": {
    "citations": { "hasMany": "citations", "via": "articleId", "description": "the raw items this article was synthesized from" }
  }
}
```

Adapted from `store/projects/blog/database/articles.json` (a real catalog template).

## Top-level fields

- **`title`** — a display title for the table `sdk/org/libs/core/src/db/schema.ts#TableSchema`.
- **`description`** — required and fail-loud; a missing/blank one throws `<table>: table is missing required "description"` `sdk/org/libs/core/src/db/validate.ts#validateTableSchema`.
- **`columns`** — a required, non-empty map; a missing map or zero columns throws `sdk/org/libs/core/src/db/validate.ts:50-57`.
- **`relations`** — optional navigable links to other tables `sdk/org/libs/core/src/db/schema.ts#TableSchema`.

## Column fields

Each column carries a required `type` and `description`; the rest are optional per-column flags `sdk/org/libs/core/src/db/schema.ts#ColumnSchema`.

| Field | Meaning |
|---|---|
| `type` | One of `string \| number \| boolean \| date \| json`; anything else throws `unknown column type` `sdk/org/libs/core/src/db/validate.ts#COLUMN_TYPES` `sdk/org/libs/core/src/db/validate.ts#validateColumn`. `date` is an ISO string, `json` an arbitrary JSON value `sdk/org/libs/core/src/db/schema.ts:12-13`. |
| `description` | **Required** on every column; blank/missing throws `<table>.<col>: column is missing required "description"` `sdk/org/libs/core/src/db/validate.ts#validateColumn`. |
| `primaryKey` | Marks the primary key; **exactly one** column per table must set it, else `must have exactly one primaryKey column` throws `sdk/org/libs/core/src/db/validate.ts:59-69`. Emits `PRIMARY KEY` `sdk/org/libs/cli/src/app/store.ts#columnDefSql`. |
| `generated` | `uuid` or `now` — auto-fills the value on insert when none is supplied; any other kind throws `sdk/org/libs/core/src/db/validate.ts#GENERATED_KINDS` `sdk/org/libs/core/src/db/validate.ts#validateColumn`. Applied at insert time (`randomUUID()` / ISO `now`) `sdk/org/libs/cli/src/app/store.ts:358-363`. |
| `required` | Emits `NOT NULL` (skipped on the PK) `sdk/org/libs/cli/src/app/store.ts#columnDefSql`. |
| `unique` | Emits `UNIQUE` (skipped on the PK) `sdk/org/libs/cli/src/app/store.ts#columnDefSql`. |
| `default` | A literal default; emits `DEFAULT <literal>` `sdk/org/libs/cli/src/app/store.ts#columnDefSql`. |
| `references` | `{ table, column?, onDelete? }` → a real SQLite `FOREIGN KEY … REFERENCES` `sdk/org/libs/core/src/db/schema.ts:28-36` `sdk/org/libs/cli/src/app/store.ts#schemaToCreateTableSql`. `column` defaults to the target's primary key `sdk/org/libs/core/src/db/validate.ts:146`; `onDelete` ∈ `cascade \| setNull \| restrict` (default `restrict`) `sdk/org/libs/core/src/db/schema.ts#OnDelete` `sdk/org/libs/cli/src/app/store.ts:183-200`. |

## Relations

Relations are declared under `relations`, discriminated by which key is present `sdk/org/libs/core/src/db/schema.ts:120-128`. Both forms require `via` and a `description`, else the load throws `sdk/org/libs/core/src/db/validate.ts:71-89`.

| Form | Meaning |
|---|---|
| `belongsTo` | This table holds the foreign key; `via` is the FK column on **this** table `sdk/org/libs/core/src/db/schema.ts#BelongsToRelation`. |
| `hasMany` | The target table holds the FK back; `via` is the FK column on the **target** table — the "many" side expandable via `db.query(..., { include })` `sdk/org/libs/core/src/db/schema.ts#HasManyRelation`. |

`validateTableSchema` (called by the single-file writers) validates one table in isolation; cross-table resolution — a `references`/relation `via` naming an unknown table or column — is checked by `validateSchemaSet` over the full set at load `sdk/org/libs/core/src/db/validate.ts#validateSchemaSet`.

## Drives `@app/types`

The table set is compiled into a TS `interface` per table under `<projectRoot>/types/generated.d.ts` (the `@app/types` module) `sdk/org/libs/cli/src/app/build/schema.ts#generateAppTypes`. Each column maps by kind (`date→string`, `json→unknown`) `sdk/org/libs/cli/src/app/build/schema.ts#COLUMN_TS`; a `required` or `primaryKey` column is non-optional, everything else optional `sdk/org/libs/cli/src/app/build/schema.ts#renderRowInterface`; each field is JSDoc'd from its `description` `sdk/org/libs/cli/src/app/build/schema.ts#renderRowInterface`. Relations become typed fields (`hasMany` → `Target[]`, `belongsTo` → `Target`, both optional) `sdk/org/libs/cli/src/app/build/schema.ts:112-127`. The interface name PascalCases the basename and singularizes its last word (`feed_items` → `FeedItem`) `sdk/org/libs/cli/src/app/build/schema.ts:137-155`. Pages and handlers consume it as `import type { Article } from '@app/types'`.

## Every committed write auto-emits a synthetic db event

A committed write to any table auto-emits the synthetic event `project/db.<table>.<insert|update|remove>` whose payload IS the written row (`rows[0]` when a burst coalesces) `sdk/org/libs/cli/src/app/hooks/runtime.ts:119-136`. Subscribe with an event hook `{ type: 'event', on: { event: 'project/db.<table>.<event>' }, handler }` — the row arrives as `ctx.input` — see [../hooks/](../hooks) and [../hooks/database.md](../hooks/database.md).

## Notes

- `db:read` / `db:write` / `db:schema` grants can be narrowed to named tables (`{ tables: [...] }`); a `tables:` entry naming a table absent from `database/` aborts the space load — see [../../space/agents/capabilities.md](../../space/agents/capabilities.md).
- `hasMany` relations are what an API handler pulls with `ctx.db.query(table, { include: ['citations'] })` — see [../api/README.md](../api/README.md).

Real examples: `store/projects/blog/database/articles.json`, `store/projects/demo-feed/database/feed_items.json`.
