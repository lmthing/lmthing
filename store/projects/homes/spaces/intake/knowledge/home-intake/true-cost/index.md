---
variable: trueCost
description: How the surveyor turns a bare asking price into an honest all-in monthly cost, with every line labelled stated or estimated — for the normalize action's trueCost() calls.
---

# Computing true cost

A listing's headline `priceAmount` is never the real monthly cost of living there. For a rental,
condo fees and utilities sit outside the quoted rent; for a purchase, the quoted price says nothing
about what the monthly mortgage payment plus recurring charges will actually be. `trueCostMonthly`
exists so two listings with very different pricing structures — a rental with fees bundled in vs.
one that quotes rent alone, a cheap-per-m² purchase in a building with steep condo fees vs. a
pricier one with none — can be compared on the SAME number.

`rent-fees-and-utilities.md` covers the rent-mode math (stated fees, estimated utilities);
`buyer-costs-and-mortgage.md` covers the buy-mode math (mortgage amortization, property tax/charges
estimates) and where to source a defensible reference rate. The one rule that spans both: every line
in `costBreakdown` is labelled `stated` (the listing said so — trust it) or `estimated` (the
surveyor's model computed it — cite the basis) via the `trueCost` function's deterministic
arithmetic. Never let a `stated` line quietly absorb an estimate, and never present an `estimated`
line as if it were a guarantee.
