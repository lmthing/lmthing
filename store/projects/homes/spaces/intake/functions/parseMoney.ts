/**
 * Parse a money amount out of a free-text price string into a normalized
 * `{ amount, currency }`. Handles the European portal idioms the clipper meets
 * most: `€1.600/mês`, `1 600 €`, `EUR 1,600`, `£925 pcm`, `450.000 €`.
 *
 * Thousands/decimal disambiguation: if a string contains BOTH `.` and `,`, the
 * LAST-occurring separator is treated as the decimal point (EU `1.600,50` and US
 * `1,600.50` both → 1600.5). A lone separator followed by exactly 3 digits is a
 * thousands group (`1.600` → 1600); otherwise it's a decimal (`1600.50` → 1600.5).
 * Never invents a currency — returns `currency: ''` when no symbol/code is present
 * so the caller can fall back to the search currency rather than guessing.
 */
const SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', '$': 'USD', '¥': 'JPY' };
const CODES = ['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'];

export function parseMoney(raw: string): { amount: number; currency: string } {
  const text = String(raw ?? '');
  if (!text.trim()) return { amount: 0, currency: '' };

  let currency = '';
  for (const [sym, code] of Object.entries(SYMBOLS)) {
    if (text.includes(sym)) { currency = code; break; }
  }
  if (!currency) {
    const upper = text.toUpperCase();
    for (const code of CODES) {
      if (new RegExp(`\\b${code}\\b`).test(upper)) { currency = code; break; }
    }
  }

  // Grab the first number-like run (digits with , . and spaces as group separators).
  const m = text.match(/\d[\d.,\s ]*\d|\d/);
  if (!m) return { amount: 0, currency };
  let numeric = m[0].replace(/[\s ]/g, '');

  const hasDot = numeric.includes('.');
  const hasComma = numeric.includes(',');
  if (hasDot && hasComma) {
    // The last separator is the decimal point; the other is thousands.
    const decimalSep = numeric.lastIndexOf('.') > numeric.lastIndexOf(',') ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    numeric = numeric.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = numeric.split(sep);
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3 && parts.slice(0, -1).every((p) => p.length <= 3)) {
      numeric = parts.join(''); // thousands group → drop the separator
    } else {
      numeric = parts.join('.').replace(/\.(?=.*\.)/g, ''); // decimal → keep one dot
    }
  }

  const amount = Number(numeric);
  return { amount: Number.isFinite(amount) ? amount : 0, currency };
}
