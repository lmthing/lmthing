# PII scanning — shapes, Luhn, and the values that never leave

`pii-scan` samples up to 50 rows per table and reports which columns hold values shaped like
personal data. It is a **map**, not a verdict: it tells the user where to look.

## The four kinds

| kind | shape | why it is drawn this way |
|---|---|---|
| `email` | `local@domain.tld` | unambiguous enough that no extra guard is needed |
| `phone` | 7–15 digits, written with separators (space, dash, parentheses) or a leading `+` | a BARE digit run is not a phone — otherwise every order number, quantity and internal id in the app reads as a phone number |
| `iban` | two letters, two check digits, 11–30 alphanumerics | the letter-digit prefix is what makes it distinguishable from a long reference code |
| `card` | 13–19 digits (separators allowed) **and** Luhn-valid | see below |

Date-shaped runs (`2026-07-26`, `2026-07-26 14:30`) are excluded from the numeric kinds — a date
column would otherwise report as a wall of phone numbers.

## The Luhn rule

Card detection **requires the Luhn checksum**, computed inline in `scanPiiInRows`. Without it, any
16-digit internal id (`1234567812345678`, an order number, a scanned barcode) is indistinguishable
from a card number, and a governance report full of false positives is a report nobody reads twice.
Luhn is a one-line filter that removes roughly nine in ten of them: `4242424242424242` passes,
`1234567812345678` does not.

It is still only a checksum. `card` in a report means *card-shaped and Luhn-valid*, never *confirmed
card number*, and neither the report nor the summary may claim otherwise.

## The guardrail: never store, never quote, never echo

`scanPiiInRows` returns `{ column, kind, count }[]` and nothing else. The matched values never
leave the function, and every layer above it keeps it that way:

- `02-scan` resolves only those triples — it does not re-scan rows to "confirm" a finding.
- `03-record` writes `detailJson` as `[{ column, kind, count }]` — **never a matched value, never a
  sample, never a redacted or partially-masked excerpt.**
- `04-report` says "3× email in `notes`" — never what the emails were, and never a description of
  them ("they look like company addresses" is a leak with extra steps).

The reason is blunt: a report that quotes the personal data it found is a second, less protected
copy of that data, sitting in a table nobody is watching, and it will be read by every agent that
later queries `archive_reports`. Counting is the entire job.

## What the scan does not do

It never deletes, masks, redacts or moves a value — this space has no delete on its surface and
never writes a host table. It never proposes a schema change. It samples, so a `count` is "at least
this many, within 50 rows" — say that when it matters, and never report a sample as a total.
