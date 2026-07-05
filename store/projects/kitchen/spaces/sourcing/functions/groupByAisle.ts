export interface ShoppingLine {
  ingredient: string;
  unit: string;
  quantity: number;
  /** grocery aisle grouping from `ingredients.category`, e.g. 'produce' | 'dairy' | 'pantry'. */
  category?: string;
  estCost?: number;
}

export interface AisleGroup {
  aisle: string;
  lines: ShoppingLine[];
  subtotal: number;
}

/**
 * Canonical store walk order. Lines whose category isn't listed fall to the end under 'other',
 * preserving a sensible shopping path (fresh perimeter first, frozen/checkout last).
 */
const AISLE_ORDER = [
  'produce',
  'bakery',
  'meat',
  'seafood',
  'deli',
  'dairy',
  'pantry',
  'canned',
  'grains',
  'spices',
  'frozen',
  'beverages',
  'household',
  'other',
];

function aisleRank(aisle: string): number {
  const i = AISLE_ORDER.indexOf(aisle);
  return i === -1 ? AISLE_ORDER.indexOf('other') : i;
}

/**
 * Group a plan's shopping lines into an aisle-ordered walk for `shopping_trips.organized`.
 * Deterministic: lines are bucketed by their `category` (normalized, defaulting to 'other'),
 * buckets are emitted in `AISLE_ORDER`, and within a bucket lines keep their incoming order.
 * Each group carries a `subtotal` summed from per-line `estCost` (0 when a line has no cost).
 * Pure — same input, same output — so a trip can be re-organized freely without drift.
 */
export function groupByAisle(lines: ShoppingLine[]): AisleGroup[] {
  const buckets = new Map<string, ShoppingLine[]>();
  for (const line of lines) {
    const aisle = (line.category ?? 'other').toLowerCase().trim() || 'other';
    const bucket = buckets.get(aisle) ?? [];
    bucket.push(line);
    buckets.set(aisle, bucket);
  }
  return [...buckets.entries()]
    .map(([aisle, ls]) => ({
      aisle,
      lines: ls,
      subtotal: round2(ls.reduce((s, l) => s + (l.estCost ?? 0), 0)),
    }))
    .sort((a, b) => aisleRank(a.aisle) - aisleRank(b.aisle));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
