# Rules — the five kinds and their configs

A rule is one row in `validation_rules`: `{ targetTable, column, kind, configJson, status,
createdAt }`. `configJson` is a JSON string; `checkRule` receives it parsed as `config`.

| kind | config | passes when |
|---|---|---|
| `required` | `{}` | the value is present and non-empty |
| `range` | `{ min?, max? }` | the value is numeric and within the bounds — a missing bound is unbounded |
| `regex` | `{ pattern, flags? }` | `new RegExp(pattern, flags).test(String(value))` |
| `enum` | `{ values: [...] }` | the value string-equals one of `values` |
| `reference` | `{ table }` | the value appears in that table's ids (the CALLER loads them and passes `refIds`) |

## The contract that makes a daily sweep trustworthy

**An unrunnable rule NEVER creates a violation.** `checkRule` returns `{ ok: true, skipped: '<why>' }`
instead:

- `invalid-pattern` — the regex does not compile (or is empty). A broken rule is a broken rule, not
  a broken row. Fix the rule in `review`; the data is not at fault.
- `no-row` — no row was passed.
- `empty` — the value is absent, for any kind other than `required`. **Presence is `required`'s job
  alone**, so one blank cell yields one violation, not five.
- `no-values` / `no-ref-ids` / `no-rule` / `unknown-kind` — the rule is not evaluable as configured.

A `skipped` result is `ok: true` on purpose: skipping is silence, never an accusation.

## The one thing `range` does accuse

A non-empty value that is not numeric IS a violation (`"n/a"` in a price column is exactly the
problem worth catching) — but an EMPTY one is skipped, per the presence rule above.

## Where rules come from

- `suggestRules(tables, samples)` at `bind` — conservative and evidence-backed: **fewer than 10
  sampled rows for a table means no suggestions for that table at all**; `required` only for
  100%-filled columns; `enum` only for string columns with ≤ 6 distinct values; `range` only for
  numeric columns, with the observed span widened by 50% on each side; `reference` only where a
  table matching the `<name>_id` prefix actually exists. The `id` column gets no
  required/enum/range rule.
- A human, in `review` — after testing the rule against a real sampled row with `checkRule`.

**Every suggested rule lands as `proposed`.** Rules become `active` only via human review. Dedupe on
`(targetTable, column, kind)`: re-binding never duplicates a rule and never resurrects a `disabled`
one.
