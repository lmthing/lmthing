# `database/<table>.json` — table schema

One JSON file per table. **Not** seed data — a declarative table definition compiled into a real
SQLite table in the project's db. Written by the authoring global `writeTableSchema(name, schema)`
(granted by the `db:schema` capability). `<table>` is a lowercase slug.

## Format

```json
{
  "title": "Articles",
  "description": "A synthesized, personalized news article shown in the user's feed.",
  "columns": {
    "id":        { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":     { "type": "string",  "description": "headline", "required": true },
    "url":       { "type": "string",  "description": "source URL", "required": true, "unique": true },
    "score":     { "type": "number",  "description": "relevance rank", "default": 0 },
    "read":      { "type": "boolean", "description": "opened yet", "default": false },
    "tags":      { "type": "json",    "description": "topic tag strings" },
    "createdAt": { "type": "date",    "description": "entered the feed", "generated": "now" }
  },
  "relations": {
    "citations": { "hasMany": "citations", "via": "articleId", "description": "sources cited" }
  }
}
```

## Column rules

- **`type`** ∈ `string | number | boolean | date | json`.
- Exactly **one** column sets `primaryKey: true` (use `generated: "uuid"`). `generated` ∈ `uuid | now`.
- Per-column flags: `required`, `unique`, `default`, and
  `references: { table, column?, onDelete? }` (`onDelete` ∈ `cascade | setNull | restrict`) →
  a real SQLite foreign key.
- **Every column needs a `description`** — validation fails loud on a missing one.

## Relations

Declared under `relations` (both forms need a `description`):

| Form | Meaning |
|---|---|
| `belongsTo` | this table holds the foreign key; `via` = its column |
| `hasMany` | the target table holds the FK back; `via` = the target's column |

`hasMany` relations are what an API handler pulls with `ctx.db.query(table, { include: ['citations'] })`
(see [../api/](../api/)).

## Notes

- The set of tables also determines the DB-derived types exposed to pages/handlers as
  `@app/types` (e.g. `import type { Article } from '@app/types'`).
- `db:read`/`db:write`/`db:schema` capability grants can be **narrowed** to named tables
  (`{ tables: [...] }`); a `tables:` entry naming a table absent from `database/` aborts the space
  load. See [../../space/agents/](../../space/agents/).
- A committed write to any table auto-emits the synthetic event `project/db.<table>.<insert|update|remove>`
  — the basis for db-triggered [hooks/](../hooks/).

Real example: `store/projects/blog/database/articles.json` (and `demo-feed/database/feed_items.json`).
