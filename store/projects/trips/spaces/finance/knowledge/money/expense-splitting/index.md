---
variable: expenseSplitting
description: How to split a trip's expenses fairly across its travelers into expense_shares, when even isn't actually fair, and how to keep the number of settle-up transactions small.
---

# Splitting expenses fairly

An `expenses` row is one real amount somebody actually spent — a dinner, a taxi, a museum ticket —
and an `expense_shares` row is one traveler's portion of it. The two have to reconcile exactly: the
sum of an expense's shares always equals the expense's `amount`, to the cent. That invariant is
what makes the settlement view trustworthy — if the shares drift even a cent from the total,
`settle-summary` will show balances that don't actually zero out across the party, and the
traveller stops trusting the number.

The treasurer's default is an **even split**: divide the amount by the number of travelers on the
trip, using `splitEvenly` so any leftover cent from the division lands on the first shares rather
than getting silently dropped or double-counted. This is deliberately the default even when it's
not perfectly fair in every case — a genuinely uneven split needs a real signal to justify it (a
child who didn't order a meal, someone who sat out a paid activity, an explicit "split this 60/40"
instruction), and absent that signal, even is the least presumptuous choice the treasurer can make
on its own. `even-vs-weighted.md` covers the specific situations where deviating from even is the
right call and how to do it without inventing a weighting nobody asked for.

The payer is still one of the shares. Splitting evenly across every traveler including the person
who fronted the money is what makes the balances net out correctly: the payer's own share reduces
what they're owed by the group, which is exactly right — they didn't personally consume more of
the shared meal just because they happened to hold the card. Trying to exclude the payer from their
own share to be "generous" actually breaks the settlement math and has to be reversed manually
later.

Once a trip has many small expenses split across several people, the resulting web of who-owes-whom
gets tangled fast — Alice owes Bob for dinner, Bob owes Carol for the taxi, Carol owes Alice for the
museum tickets. `settlement-minimization.md` covers how the treasurer collapses that web into the
smallest possible set of actual transfers, so the party settles up with two or three payments
instead of a dozen.
