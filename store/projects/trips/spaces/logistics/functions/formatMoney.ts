/**
 * Format an amount with its ISO currency code, using `Intl.NumberFormat` when the currency code is
 * recognized and falling back to a plain "<code> <amount>" format otherwise (some queried
 * currencies from webSearch results may be malformed or non-ISO). Pure formatting — no rounding
 * decisions beyond what the currency's standard number of decimal places dictates.
 */
export function formatMoney(amount: number, currency: string): string {
  const code = (currency || 'USD').toUpperCase().trim();

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    // Intl.NumberFormat throws on an invalid/unrecognized ISO 4217 code.
    const rounded = Math.round(amount * 100) / 100;
    return `${code} ${rounded.toFixed(2)}`;
  }
}
