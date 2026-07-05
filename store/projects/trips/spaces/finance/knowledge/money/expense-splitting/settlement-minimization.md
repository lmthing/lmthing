# Minimizing settlement transactions

## Why pairwise settling produces too many transfers

The naive way to settle a trip's shared expenses is to walk through every expense and have each
non-payer pay the payer back directly for their share of that specific expense. Across a real trip
with a dozen shared meals, a couple of taxis, and a group activity or two, this produces a
transaction for nearly every expense — Alice pays Bob for dinner, Bob pays Carol for the taxi,
Carol pays Alice for museum tickets, and so on. Most of those transfers are unnecessary: if Alice
owes Bob $20 and Bob separately owes Alice $15, the honest settlement is a single $5 transfer from
Alice to Bob, not two payments in opposite directions.

## The net-balance approach

The fix is to stop thinking about it expense-by-expense and instead compute one **net balance** per
traveler across the whole trip: total amount they paid out (as the payer on any expense) minus
total amount they owe (the sum of their `expense_shares.shareAmount` across every expense). A
positive net means the group owes them money; a negative net means they owe the group. Because
every expense's shares sum exactly to that expense's amount, the sum of all travelers' net balances
across the whole trip is always zero — money doesn't appear or disappear, it just needs
redistributing.

## Greedy minimal-transfer matching

`settleDebts` takes that list of net balances and produces the smallest practical set of transfers
that zeroes everyone out, using a greedy match: sort debtors (negative net) and creditors (positive
net) by size, then repeatedly pair off the largest debtor with the largest creditor for as much as
the smaller of the two amounts, reducing both, and moving to the next pair once one side hits zero.
This is the same approach group-expense apps like Splitwise use, and it provably needs no more than
(number of travelers − 1) transfers to settle a group of any size — usually far fewer in practice.

## Presenting it to the traveller

A settlement summary is more useful as "who pays whom" than as a list of individual balances alone
— a traveller wants to know the concrete action, not just where they stand. Present both: the net
balance per traveler (so everyone can sanity-check the starting point) and then the minimal
transfer list underneath it as the actual next step. If a transfer amount would round to zero (two
travelers already balanced against each other), skip it — a "$0.00" transfer is noise, not useful
information.
