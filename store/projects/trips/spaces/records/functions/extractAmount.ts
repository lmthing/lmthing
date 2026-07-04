/**
 * Pull a single money amount and its currency out of free text — the "total" a booking
 * confirmation states, as best as regex parsing of real-world formatting can determine. Prefers an
 * amount explicitly labeled "total"/"amount charged"/"grand total" over the first number seen, since
 * confirmations often show a nightly rate or a per-person fare before the total. Returns `null`
 * when no confident amount/currency pair is found — an absent cost should stay absent, never
 * guessed.
 */
export function extractAmount(text: string): { amount: number; currency: string } | null {
  const t = text ?? '';

  const symbolToCurrency: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

  // Matches an optional label, then a currency symbol or ISO code, then a numeric amount with
  // optional thousands separators and up to 2 decimal places.
  const pattern = /(total|amount charged|grand total|total due|total paid)?\s*[:\-]?\s*(USD|EUR|GBP|JPY|CAD|AUD|[$€£¥])\s*([\d,]+(?:\.\d{1,2})?)/gi;

  const candidates: { amount: number; currency: string; labeled: boolean }[] = [];
  for (const m of t.matchAll(pattern)) {
    const rawAmount = m[3].replace(/,/g, '');
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) continue;
    const token = m[2];
    const currency = symbolToCurrency[token] ?? token.toUpperCase();
    candidates.push({ amount, currency, labeled: Boolean(m[1]) });
  }

  if (candidates.length === 0) return null;

  const labeled = candidates.filter((c) => c.labeled);
  const best = labeled.length > 0 ? labeled[labeled.length - 1] : candidates[0];
  return { amount: best.amount, currency: best.currency };
}
