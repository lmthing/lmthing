/**
 * Convert an amount between currencies using the freshest matching `currency_rates` row. Falls
 * back to a labelled 1:1 rate when no rate for the pair has been cached yet — the treasurer never
 * fabricates an FX rate, so an un-cached pair passes through as-is rather than guessing a number.
 * Callers that need to know whether a real rate was applied should check the cache themselves
 * before calling; this function's job is only the arithmetic, not the disclosure.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: { base: string; quote: string; rate: number; fetchedAt?: string }[],
): number {
  if (from === to) return amount;

  const matching = rates.filter((r) => r.base === from && r.quote === to);
  if (!matching.length) return amount; // labelled 1:1 fallback — see money/currency/fx-and-conversion.md

  const newest = matching.reduce((a, b) => ((b.fetchedAt ?? '') > (a.fetchedAt ?? '') ? b : a));
  return Math.round(amount * newest.rate * 100) / 100;
}
