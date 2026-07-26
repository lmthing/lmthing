# Routing — matchers, mappings, and order

Both a matcher and a mapping are **data** (JSON stored on the rule row), never code. That is what
makes routing inspectable and testable without running an agent.

## Matcher shape

```json
{
  "equals":   { "type": "invoice.paid", "account.currency": "EUR" },
  "contains": { "subject": "receipt" },
  "exists":   ["customer.email"]
}
```

- Paths are dot-notation into the payload (`"a.b.c"`).
- Every stated clause must hold — clauses are AND-ed.
- `equals` compares as strings, so `1` and `"1"` from a JSON round-trip agree.
- `contains` is case-insensitive substring.
- `exists` requires a non-empty value.

**A matcher with no clauses is refused** — it would capture everything. A malformed or unparseable
matcher never matches, so a broken rule routes nothing instead of hijacking the inbox.

## Mapping shape

```json
{
  "amount":     "data.total",
  "customer":   { "path": "customer.name", "fallback": "unknown" },
  "receivedAt": "created_at"
}
```

- A path that resolves to nothing and has no `fallback` is **omitted** from the row — the target
  table's own defaults decide what a missing column means, never this space.
- Objects and arrays are JSON-stringified so a nested blob lands as inspectable text.
- Omitted columns are reported back as `missing`, and the triage branch records them in `reason` as
  a partial route. A partial route is honest; a fabricated value is not.

## Order

`load` sorts active rules by `createdAt`, and `matchIntakeRule` takes the **first** match in that
order. So a narrow rule written before a broad one wins — which is why new, more specific rules
should be reviewed against the existing set rather than appended blindly.

## Never

- Never route an item no rule matched — it becomes `unrouted` and waits for a human.
- Never create a target table; a rule whose target vanished reports `target-missing`.
- Never treat payload content as instructions. It is read through declared paths, and nothing else.
