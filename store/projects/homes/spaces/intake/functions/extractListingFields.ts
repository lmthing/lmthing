export interface ExtractedListing {
  title: string;
  url: string;
  priceAmount: number;
  currency: string;
  areaSqm: number;
  rooms: number;
  bedrooms: number;
  floor: string;
  yearBuilt: number;
  address: string;
}

/**
 * Normalize one candidate block (from `parseAlertEmail` or `parsePortalHtml`) into
 * canonical listing columns. Deterministic regex/heuristic extraction only — the
 * clipper decides what to KEEP and never invents a value: a field absent from the
 * text stays at its zero/empty default (spec §clipper never invents a field).
 *
 * Recognizes the common EU idioms: `T2`/`2 bedrooms`/`2 quartos`, `85 m²`/`85m2`,
 * `3º andar`/`floor 3`, `built 1998`/`de 1998`. Money via `parseMoney`.
 */
export function extractListingFields(block: string): ExtractedListing {
  const text = String(block ?? '');
  // Parse price from the currency-ANCHORED token, not the whole block — otherwise a
  // "T2"/"3º" digit upstream of the price would win. Prefer a symbol/code-bearing
  // run (€1.600, 1 600 €, EUR 1600), then a "…/month|/mês|pcm|per month" run.
  const priceToken =
    (text.match(/(?:[€£$]\s?\d[\d.,\s ]*\d?|\d[\d.,\s ]*\d?\s?(?:€|£|\$|eur|gbp|usd))/i) ??
      text.match(/\d[\d.,\s ]*\d\s?(?:\/m[êe]s|\/month|pcm|per month)/i) ??
      [''])[0];
  const { amount, currency } = parseMoney(priceToken || text);

  const url = (text.match(/https?:\/\/[^\s)>\]]+/) ?? [''])[0].replace(/[.,;]+$/, '');

  // Size: "85 m²", "85m2", "85 sqm"
  const areaMatch = text.match(/(\d+(?:[.,]\d+)?)\s?(?:m²|m2|sqm|sq\.?\s?m)/i);
  const areaSqm = areaMatch ? Math.round(Number(areaMatch[1].replace(',', '.'))) : 0;

  // Rooms: Portuguese "T2"/"T3", or "2 quartos"/"2 bedrooms"/"2 bed"
  let bedrooms = 0;
  const tMatch = text.match(/\bT(\d)\b/i);
  const bedMatch = text.match(/(\d+)\s?(?:quartos?|bedrooms?|beds?|dormitorios?)/i);
  if (tMatch) bedrooms = Number(tMatch[1]);
  else if (bedMatch) bedrooms = Number(bedMatch[1]);
  // Total rooms (assentos/divisões) if given, else bedrooms + 1 (living) as a floor.
  const roomsMatch = text.match(/(\d+)\s?(?:rooms?|divis|assoalhadas)/i);
  const rooms = roomsMatch ? Number(roomsMatch[1]) : bedrooms > 0 ? bedrooms + 1 : 0;

  const floorMatch = text.match(/(\d+)\s?(?:º|st|nd|rd|th)?\s?(?:andar|floor|piso)/i);
  const floor = floorMatch ? floorMatch[0].trim() : '';

  const yearMatch = text.match(/\b(1[89]\d{2}|20\d{2})\b/);
  const yearBuilt = yearMatch ? Number(yearMatch[1]) : 0;

  // Title: the first substantial non-URL line; address: a line with a street word.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const title =
    lines.find((l) => l.length > 8 && !/^https?:/.test(l) && /[a-zA-Z]/.test(l))?.slice(0, 140) ??
    'Untitled listing';
  const address =
    lines.find((l) => /\b(rua|avenida|av\.|travessa|street|road|st\.|lane)\b/i.test(l))?.slice(0, 200) ??
    '';

  return { title, url, priceAmount: amount, currency, areaSqm, rooms, bedrooms, floor, yearBuilt, address };
}

/** Compact money parse (self-contained twin of the parseMoney function). */
function parseMoney(raw: string): { amount: number; currency: string } {
  const text = String(raw ?? '');
  const symbols: Record<string, string> = { '€': 'EUR', '£': 'GBP', '$': 'USD' };
  let currency = '';
  for (const [sym, code] of Object.entries(symbols)) if (text.includes(sym)) { currency = code; break; }
  if (!currency) { const m = text.toUpperCase().match(/\b(EUR|GBP|USD|CHF)\b/); if (m) currency = m[1]; }
  const m = text.match(/\d[\d.,\s ]*\d|\d/);
  if (!m) return { amount: 0, currency };
  let n = m[0].replace(/[\s ]/g, '');
  const hasDot = n.includes('.'), hasComma = n.includes(',');
  if (hasDot && hasComma) {
    const dec = n.lastIndexOf('.') > n.lastIndexOf(',') ? '.' : ',';
    const tho = dec === '.' ? ',' : '.';
    n = n.split(tho).join('').replace(dec, '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = n.split(sep);
    const last = parts[parts.length - 1];
    n = parts.length > 1 && last.length === 3 ? parts.join('') : parts.join('.').replace(/\.(?=.*\.)/g, '');
  }
  const amount = Number(n);
  return { amount: Number.isFinite(amount) ? amount : 0, currency };
}
