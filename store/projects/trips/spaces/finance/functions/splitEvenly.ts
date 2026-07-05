/**
 * Split an amount evenly across `count` shares, working in integer cents so the result never
 * drifts from floating-point division, and distributing any leftover cent(s) from the rounding to
 * the first shares. The returned amounts always sum EXACTLY to `amount` (to the cent) — the
 * treasurer never writes `expense_shares` whose total is off by a rounding error.
 */
export function splitEvenly(amount: number, count: number): number[] {
  if (count <= 0) return [];

  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  const shares: number[] = [];
  for (let i = 0; i < count; i++) {
    const cents = baseCents + (i < remainderCents ? 1 : 0);
    shares.push(cents / 100);
  }
  return shares;
}
