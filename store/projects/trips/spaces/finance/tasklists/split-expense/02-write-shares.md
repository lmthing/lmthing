---
id: write_shares
output:
  ok: boolean
  written: number
dependsOn: [load_party]
role: general
functions:
  - splitEvenly
---

Write one `expense_shares` row per traveler from `load_party` (available as `load_party.travelerIds`
etc.), using `splitEvenly` so the shares sum exactly to the expense amount. Do this in a **single
loop** — insert each share with `db.insert` directly (you hold `db:write` on `expense_shares`).
Skip entirely if this expense already has shares, so re-running the tasklist for the same expense
never double-writes:

```ts
const existing = db.query('expense_shares', { where: { expenseId } });

if (existing.length) {
  currentTask.resolve({ ok: true, written: 0 });
} else {
  const { travelerIds, amount, currency } = load_party;
  const amounts = splitEvenly(amount, travelerIds.length);

  let written = 0;
  for (let i = 0; i < travelerIds.length; i++) {
    db.insert('expense_shares', {
      expenseId,
      travelerId: travelerIds[i],
      shareAmount: amounts[i],
      currency,
      settled: false,
    });
    written++;
  }
  currentTask.resolve({ ok: true, written });
}
```
