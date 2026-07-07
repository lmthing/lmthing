/**
 * Format a numeric amount + ISO currency into a compact, human display string,
 * e.g. `formatMoney(1600, 'EUR')` → `€1,600`. Deterministic (no locale drift):
 * a fixed symbol map, en-US thousands grouping, no fractional cents for whole
 * amounts. Falls back to `<code> <amount>` for currencies without a known symbol.
 */
const SYMBOL: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', JPY: '¥' };

export function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const whole = Math.round(n) === n;
  const grouped = n.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sym = SYMBOL[(currency ?? '').toUpperCase()];
  return sym ? `${sym}${grouped}` : `${(currency || '').toUpperCase()} ${grouped}`.trim();
}
