/**
 * Roll up a list of expenses into per-category totals, for the treasurer's spend-breakdown views.
 * Assumes every input amount is already in one common currency — convert first with
 * `convertAmount` when the expenses being summed span more than one currency.
 */
export function sumByCategory(
  expenses: { category: string; amount: number }[],
): { category: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const current = totals.get(e.category) ?? 0;
    totals.set(e.category, Math.round((current + e.amount) * 100) / 100);
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount }));
}
