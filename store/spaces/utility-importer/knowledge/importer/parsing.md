# Parsing — what the functions guarantee

## CSV (`parseCsvRows`)

- **Delimiter detection** picks the candidate (`,` `;` tab `|`) giving the most *consistent* column
  count over the first five rows, requiring at least two columns. A comma-heavy free-text field
  therefore cannot outvote a real semicolon delimiter.
- **Quoting** is RFC-4180: a quoted field may contain the delimiter, newlines, and `""` for a
  literal quote.
- **Tolerated noise**: UTF-8 BOM, CRLF/CR, blank lines, a trailing newline.
- **Ragged rows** are padded (missing cells → `''`) or truncated to the header width, and counted
  in `raggedRows`. Always report that count — a ragged file usually means the wrong delimiter or a
  broken export, and the user should know before inserting.
- Header and cell values are trimmed.

## JSON (`parseJsonRows`)

Accepts a bare array of objects, or an object wrapping one — `items`, `data`, `results`, `records`,
`rows` are checked first, then the first property whose value is an array of objects. Non-object
entries are **skipped and counted**, never coerced into empty rows. `shape` tells you which form
was found (`array`, `wrapped:data`, `none`).

## Numbers are locale-tolerant, deliberately

In `coerceRowToTarget`, two rules resolve the `,`/`.` ambiguity:

1. **Both separators present** → the LAST one is the decimal point, the other groups thousands.
2. **Only one kind present** → a separator followed by *exactly three digits* is a thousands
   group (and two or more groups always are); anything else is a decimal point.

| Input | Reads as | Why |
|---|---|---|
| `1,234.50` | 1234.5 | rule 1 — dot is last |
| `1.234,50` | 1234.5 | rule 1 — comma is last |
| `1,234` | 1234 | rule 2 — exactly three trailing digits |
| `1.234` | 1234 | rule 2 — same, the other way round |
| `1.234.567` | 1234567 | rule 2 — multiple groups |
| `12.5` | 12.5 | rule 2 — not a three-digit group |
| `1,23` | 1.23 | rule 2 — not a three-digit group |

Rule 2 is a judgment call on genuinely ambiguous input (`1.234` *could* be 1.234), resolved toward
what export files actually contain. It is applied identically every time, and the dry run shows the
parsed numbers before anything is inserted.

A value that cannot be read as a number is **not** written — it becomes an issue. This is the whole
point: silent coercion is how an import turns `1.234,50` into `1.234`.

## Dates

Only the unambiguous shapes: `YYYY-MM-DD`, `YYYY/MM/DD`, those with a time part, and epoch
seconds/milliseconds. Everything else is an issue. `03/04/2026` is deliberately NOT parsed — there
is no way to know whether it is March or April, and guessing wrong is worse than reporting.

## Booleans

`true/false`, `yes/no`, `y/n`, `1/0` (case-insensitive). Anything else is an issue.
