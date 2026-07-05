/**
 * Reduce a set of per-traveler net balances (positive = owed money by the group, negative = owes
 * the group) to a minimal set of point-to-point transfers that settles everyone up, using a greedy
 * largest-debtor-to-largest-creditor match. This is the standard minimal-transaction settlement —
 * see `money/expense-splitting/settlement-minimization.md` for why this beats settling every pair
 * of travelers individually.
 */
export function settleDebts(
  balances: { travelerId: string; net: number }[],
): { from: string; to: string; amount: number }[] {
  const EPS = 0.01;

  const debtors = balances
    .filter((b) => b.net < -EPS)
    .map((b) => ({ travelerId: b.travelerId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.net > EPS)
    .map((b) => ({ travelerId: b.travelerId, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

    if (amount > EPS) {
      transfers.push({ from: debtor.travelerId, to: creditor.travelerId, amount });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= EPS) i++;
    if (creditor.amount <= EPS) j++;
  }

  return transfers;
}
