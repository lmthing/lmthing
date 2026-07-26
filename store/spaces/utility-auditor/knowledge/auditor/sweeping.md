# Sweeping — how log entries come to exist

One sweep pass per table: load its current rows and its `audit_snapshots` → classify every row →
append `audit_log` entries → bring the snapshots back in line with reality.

## Baseline semantics — the first sweep logs NOTHING

A table with **no snapshot rows at all** is being audited for the first time. That pass is a
BASELINE: it seeds `audit_snapshots` and writes **zero** `audit_log` entries.

This is not an optimization, it is correctness. The log's claim is "this changed on this day". On
day one nothing changed — the auditor simply arrived. Logging 4,000 `added` entries because a
binding was activated would date every existing row to the day the space was installed, and every
later report built on that log would be wrong about when things happened.

Note the exact test: **no snapshots for that table**, not "no rows". A table whose rows were all
removed still has (tombstoned) snapshots and is NOT a baseline — its emptiness is a real change
and gets logged.

## The three change kinds

| Kind | Condition |
|---|---|
| `added` | a current row whose id has NO snapshot |
| `changed` | a current row whose snapshot exists and whose `rowHash` differs |
| `removed` | a snapshot with `rowHash !== 'removed'` whose row is no longer present |

`changed` entries carry the column-level detail from `diffRows`: `changedColumnsJson` plus the
verbatim before/after values. A row without a usable id cannot be tracked at all and is skipped —
identity is what makes a change loggable.

## The hash contract

`hashRow(row)` is djb2-xor over the row's canonical serialization (`stableStringify`: object keys
sorted recursively, arrays in order). Two consequences the sweep depends on:

- **Key order is not a change.** A row re-serialized with different key insertion order hashes
  identically, so a storage-layer reshuffle does not produce a log full of phantom changes.
- **Any value change is a change.** Nested objects and arrays are compared by value, and a column
  that appears or disappears counts — `diffRows` walks the UNION of both key sets.

`rowHash` is stored alongside `rowJson` so the next sweep can decide "changed?" with one string
comparison instead of re-diffing every row.

## Tombstones — because there is no delete

The agent surface has `db.insert` and `db.update` and nothing else. A row that disappears from the
host table therefore cannot have its snapshot deleted; instead the snapshot is **tombstoned**:

```ts
db.update('audit_snapshots', { where: { id: snapshotId }, set: { rowJson: '', rowHash: 'removed', updatedAt: nowIso } });
```

`rowHash: 'removed'` is a sentinel, and the `removed` detector explicitly skips snapshots already
carrying it. Without the tombstone the next sweep would find the same missing row, log `removed`
again, and keep doing so every day forever — one deletion becoming an unbounded stream of
identical entries.

If the row comes BACK with the same id, its hash will differ from `'removed'`, so it is logged as
`changed` and the tombstone is overwritten with the live state. (An `added`/`removed` pair would be
a lie about identity: the id never went away.)

## The dedupe contract

`computeChangeKey(targetTable, rowId, change, sweepAt)` truncates `sweepAt` to the DAY.
Consequences:

- Re-running a sweep the same day (retry, resume, manual run) inserts nothing new.
- The same row changing again on a LATER day is a new entry — that's a real event.
- Two changes to one row within one day collapse into one entry. Daily granularity is the promise;
  do not pretend to more.
- Check-before-insert is mandatory: query `audit_log` filtered by the key first
  (`db.query('audit_log', { where: { changeKey: key } })`), insert only when empty.

## What a sweep never does

- Never writes any host-app table — no grant exists for it.
- Never edits or deletes an `audit_log` entry. The log is append-only.
- Never paraphrases a value: `beforeJson`/`afterJson` hold the row as it was, verbatim.
- Never notifies: delivery belongs to consumers of `project/db.audit_log.insert`.

## Failure honesty

A binding whose table no longer exists (schema drifted since bind) is reported in the sweep summary
as a stale binding — it is NOT disabled automatically, and its snapshots are NOT tombstoned. A
dropped table is a schema event, not four thousand row deletions.
