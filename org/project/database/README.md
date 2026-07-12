# `database/<table>.json` — table schema

One JSON file per table, keyed by the file **basename** (`database/articles.json` → table `articles`); the table name is NOT stored inside the JSON `sdk/org/libs/core/src/db/schema.ts:93-107`. A schema file is a **declarative table definition**, not seed data — it is compiled into a real SQLite `CREATE TABLE` statement at boot `sdk/org/libs/cli/src/app/store.ts:230-242`. Written by the authoring globals `writeTableSchema(name, schema)` (catalog templates) and `writeProjectTable(name, schema)` (the live project), both gated by the `db:schema` capability `sdk/org/libs/cli/src/app/authoring/globals.ts:172-183` `sdk/org/libs/cli/src/app/authoring/globals.ts:349-365`. Table names are snake_case (`^[a-z][a-z0-9_]*$`), used verbatim in `CREATE TABLE <name>` `sdk/org/libs/cli/src/app/authoring/globals.ts:45`.

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

- **`title`** — a display title for the table `sdk/org/libs/core/src/db/schema.ts:99`.
- **`description`** — required and fail-loud; a missing/blank one throws `<table>: table is missing required "description"` `sdk/org/libs/core/src/db/validate.ts:46-48`.
- **`columns`** — a required, non-empty map; a missing map or zero columns throws `sdk/org/libs/core/src/db/validate.ts:50-57`.
- **`relations`** — optional navigable links to other tables `sdk/org/libs/core/src/db/schema.ts:105-106`.

## Column fields

Each column carries a required `type` and `description`; the rest are optional per-column flags `sdk/org/libs/core/src/db/schema.ts:42-59`.

| Field | Meaning |
|---|---|
| `type` | One of `string \| number \| boolean \| date \| json`; anything else throws `unknown column type` `sdk/org/libs/core/src/db/validate.ts:21-27` `sdk/org/libs/core/src/db/validate.ts:98-102`. `date` is an ISO string, `json` an arbitrary JSON value `sdk/org/libs/core/src/db/schema.ts:12-13`. |
| `description` | **Required** on every column; blank/missing throws `<table>.<col>: column is missing required "description"` `sdk/org/libs/core/src/db/validate.ts:94-97`. |
| `primaryKey` | Marks the primary key; **exactly one** column per table must set it, else `must have exactly one primaryKey column` throws `sdk/org/libs/core/src/db/validate.ts:59-69`. Emits `PRIMARY KEY` `sdk/org/libs/cli/src/app/store.ts:207`. |
| `generated` | `uuid` or `now` — auto-fills the value on insert when none is supplied; any other kind throws `sdk/org/libs/core/src/db/validate.ts:29` `sdk/org/libs/core/src/db/validate.ts:103-107`. Applied at insert time (`randomUUID()` / ISO `now`) `sdk/org/libs/cli/src/app/store.ts:358-363`. |
| `required` | Emits `NOT NULL` (skipped on the PK) `sdk/org/libs/cli/src/app/store.ts:208`. |
| `unique` | Emits `UNIQUE` (skipped on the PK) `sdk/org/libs/cli/src/app/store.ts:209`. |
| `default` | A literal default; emits `DEFAULT <literal>` `sdk/org/libs/cli/src/app/store.ts:210-212`. |
| `references` | `{ table, column?, onDelete? }` → a real SQLite `FOREIGN KEY … REFERENCES` `sdk/org/libs/core/src/db/schema.ts:28-36` `sdk/org/libs/cli/src/app/store.ts:234-239`. `column` defaults to the target's primary key `sdk/org/libs/core/src/db/validate.ts:146`; `onDelete` ∈ `cascade \| setNull \| restrict` (default `restrict`) `sdk/org/libs/core/src/db/schema.ts:26` `sdk/org/libs/cli/src/app/store.ts:183-200`. |

## Relations

Relations are declared under `relations`, discriminated by which key is present `sdk/org/libs/core/src/db/schema.ts:120-128`. Both forms require `via` and a `description`, else the load throws `sdk/org/libs/core/src/db/validate.ts:71-89`.

| Form | Meaning |
|---|---|
| `belongsTo` | This table holds the foreign key; `via` is the FK column on **this** table `sdk/org/libs/core/src/db/schema.ts:65-72`. |
| `hasMany` | The target table holds the FK back; `via` is the FK column on the **target** table — the "many" side expandable via `db.query(..., { include })` `sdk/org/libs/core/src/db/schema.ts:78-85`. |

`validateTableSchema` (called by the single-file writers) validates one table in isolation; cross-table resolution — a `references`/relation `via` naming an unknown table or column — is checked by `validateSchemaSet` over the full set at load `sdk/org/libs/core/src/db/validate.ts:119-175`.

## Drives `@app/types`

The table set is compiled into a TS `interface` per table under `<projectRoot>/types/generated.d.ts` (the `@app/types` module) `sdk/org/libs/cli/src/app/build/schema.ts:348-364`. Each column maps by kind (`date→string`, `json→unknown`) `sdk/org/libs/cli/src/app/build/schema.ts:73-79`; a `required` or `primaryKey` column is non-optional, everything else optional `sdk/org/libs/cli/src/app/build/schema.ts:107-109`; each field is JSDoc'd from its `description` `sdk/org/libs/cli/src/app/build/schema.ts:108-109`. Relations become typed fields (`hasMany` → `Target[]`, `belongsTo` → `Target`, both optional) `sdk/org/libs/cli/src/app/build/schema.ts:112-127`. The interface name PascalCases the basename and singularizes its last word (`feed_items` → `FeedItem`) `sdk/org/libs/cli/src/app/build/schema.ts:137-155`. Pages and handlers consume it as `import type { Article } from '@app/types'`.

## Every committed write auto-emits a synthetic db event

A committed write to any table auto-emits the synthetic event `project/db.<table>.<insert|update|remove>` whose payload IS the written row (`rows[0]` when a burst coalesces) `sdk/org/libs/cli/src/app/hooks/runtime.ts:119-136`. Subscribe with an event hook `{ type: 'event', on: { event: 'project/db.<table>.<event>' }, handler }` — the row arrives as `ctx.input` — see [../hooks/](../hooks/) and [../hooks/database.md](../hooks/database.md).

## Notes

- `db:read` / `db:write` / `db:schema` grants can be narrowed to named tables (`{ tables: [...] }`); a `tables:` entry naming a table absent from `database/` aborts the space load — see [../../space/agents/capabilities.md](../../space/agents/capabilities.md).
- `hasMany` relations are what an API handler pulls with `ctx.db.query(table, { include: ['citations'] })` — see [../api/README.md](../api/README.md).

Real examples: `store/projects/blog/database/articles.json`, `store/projects/demo-feed/database/feed_items.json`.
