/**
 * Compute a canonical identity key for a listing so the SAME unit cross-posted on
 * two portals collapses to one row, while genuinely different units stay separate.
 *
 * The key is a join of four coarse, portal-independent bands (spec §Dedupe):
 *   - normalized address token (lowercased, accent-stripped, street-type words and
 *     punctuation removed, sorted so "Rua das Flores 12" == "12, r. flores")
 *   - room count
 *   - size BAND (5 m² buckets — portals round differently)
 *   - price BAND (~5% log-buckets — the same unit is often re-listed a few percent
 *     apart; log-banding groups any two prices within ~5% into the same bucket
 *     regardless of magnitude, so €1,600 vs €1,650 match but €1,600 vs €2,400 don't)
 *
 * Coarse on purpose: two near-identical rows land on the same key and the clipper
 * MERGES; a borderline pair (same street + size, different price band) lands on
 * DIFFERENT keys and is surfaced for the user to resolve rather than silently
 * merged. See `listing-parsing/dedupe-and-canonicalization`.
 */
const STREET_WORDS = new Set([
  'rua', 'r', 'avenida', 'av', 'travessa', 'tv', 'largo', 'praca', 'praça',
  'calcada', 'estrada', 'street', 'st', 'road', 'rd', 'avenue', 'ave', 'lane',
  'ln', 'drive', 'dr', 'de', 'da', 'do', 'das', 'dos', 'the', 'no', 'nº',
]);

function normalizeAddress(address: string): string {
  const stripped = String(address ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ');
  const tokens = stripped
    .split(/\s+/)
    .filter((t) => t && !STREET_WORDS.has(t))
    .sort();
  return tokens.join('-') || 'unknown';
}

export function dedupeKey(input: {
  address?: string;
  rooms?: number;
  areaSqm?: number;
  priceAmount?: number;
}): string {
  const addr = normalizeAddress(input.address ?? '');
  const rooms = Math.max(0, Math.round(input.rooms ?? 0));
  const sizeBand = Math.round((input.areaSqm ?? 0) / 5); // 5 m² buckets
  const price = input.priceAmount ?? 0;
  // ~5% log-buckets: any two prices within 5% share a bucket at any magnitude.
  const priceBand = price > 0 ? Math.round(Math.log(price) / Math.log(1.05)) : 0;
  return `${addr}|r${rooms}|s${sizeBand}|p${priceBand}`;
}
