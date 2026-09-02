## `database/` — one JSON file per table

The file's basename IS the table name, snake_case `^[a-z][a-z0-9_]*$` (`database/feed_items.json` → table `feed_items`); the name is not stored inside the JSON. Author with `writeProjectTable(name, schema, rows?)` — the optional third arg seeds rows — gated by the `db:schema` capability.

Required top-level: a non-empty `description` (fail-loud) and a non-empty `columns` map. Each column requires `type` ∈ `string | number | boolean | date | json` and a `description`; `date` is an ISO string, `json` an arbitrary value. Optional per column: exactly ONE `primaryKey: true` per table (fail-loud otherwise), `generated: 'uuid' | 'now'` (auto-filled on insert), `required` (NOT NULL), `unique`, a closed `enum` value domain for a string column, a literal `default`, and `references: { table, column?, onDelete? }` (`cascade | setNull | restrict`, default `restrict`) → a real SQLite FOREIGN KEY. `relations` add navigable links: `belongsTo` (the FK lives on this table, `via` = the local column) or `hasMany` (the FK lives on the target, `via` = its column) — both need `via` and a `description`.

Schemas are validated fail-loud by `validateTableSchema`; cross-table references are checked over the full set at load. The set compiles to `CREATE TABLE` in `.data/app.db` and to TS row interfaces under `types/` (`@app/types`) that handlers and views import. Every committed write auto-emits `project/db.<table>.<insert|update|remove>` whose payload IS the row.

Grounded: `org/docs/format/project/database/README.md`; real example `store/projects/demo-feed/database/feed_items.json`.
