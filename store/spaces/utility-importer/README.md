# utility-importer — files in, rows out

Paste a CSV or JSON, pick a table, confirm the mapping, review a dry run, and the rows land —
deduped by a natural key you chose. Nothing is inserted before both confirmations.

Interactive by nature, so this space is prose-driven: the whole flow is one live session with the
importer agent, and every mechanical part of it (parsing, mapping, coercion, dedupe keys) is a pure
unit-tested function rather than something the model re-derives.

## Own table

| Table | Purpose |
|---|---|
| `import_jobs` | One row per completed import: `targetTable`, `sourceKind`, `rowsTotal`, `inserted`, `skippedDuplicates`, `skippedInvalid`, `issuesJson`, `createdAt` |

## Agent

`importer` — actions:

- **`import`** (live session): the eight-step flow with two mandatory gates (target table, dry run).
- **`history`** (live session): past jobs and their recorded issues.

## No hooks — deliberately

An import is a decision, not a schedule. This space ships no `hooks/` directory: nothing here
should ever run unattended, because every path through it ends in inserting rows into a table the
user picked.

## What it will not do

- Insert before a confirmed mapping and a reviewed dry run.
- Coerce a value past its type hint, or fill an empty cell with a default.
- Create a table or add a column.
- Undo an import — there is no delete on the agent surface, and rows carry no import marker. The
  dry run is the undo.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
