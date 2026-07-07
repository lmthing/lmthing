type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

export const name = 'parseExpense';
export const description =
  'Parse a free-text expense line ("€48 dinner at Ramiro, split with Ana and Bob") into a structured draft — amount, currency, category, and which travelers to split across — grounded in the trip roster for name resolution. Returns a draft to confirm; it does NOT write anything.';

export interface Input {
  id: string;
  text: string;
}

export interface Draft {
  amount: number;
  currency: string;
  category: string;
  description: string;
  paidByTravelerId?: string;
  splitTravelerIds: string[];
  confidence: number;
}

export interface Output {
  draft: Draft;
}

interface Trip {
  id: string;
  homeCurrency?: string;
}
interface Traveler {
  id: string;
  name: string;
}

const SYMBOL_CCY: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', '¥': 'JPY' };

const CATEGORY_HINTS: [RegExp, string][] = [
  [/\b(dinner|lunch|breakfast|brunch|restaurant|cafe|coffee|bar|drinks|food|meal|tapas|snack)\b/i, 'food'],
  [/\b(taxi|uber|cab|train|metro|bus|tram|ferry|flight|car|fuel|gas|parking|transit|transfer)\b/i, 'transit'],
  [/\b(hotel|airbnb|hostel|lodging|room|stay|apartment)\b/i, 'lodging'],
  [/\b(ticket|museum|tour|activity|entrance|entry|show|concert|park|guide)\b/i, 'activity'],
  [/\b(shop|shopping|souvenir|gift|market|store)\b/i, 'shopping'],
];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const text = (input.text ?? '').trim();
  const trips = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const homeCurrency = (trips[0]?.homeCurrency ?? 'USD').toUpperCase();
  const travelers = (await ctx.db.query('travelers', { where: { tripId: input.id } })) as Traveler[];

  // Amount + currency.
  const symMatch = text.match(/([€$£¥])\s*([\d.,]+)/);
  const numMatch = text.match(/(\d[\d.,]*)\s*(eur|usd|gbp|jpy|dollars?|euros?|pounds?)?/i);
  let amount = 0;
  let currency = homeCurrency;
  if (symMatch) {
    amount = Number(symMatch[2]!.replace(/,/g, ''));
    currency = SYMBOL_CCY[symMatch[1]!] ?? homeCurrency;
  } else if (numMatch) {
    amount = Number(numMatch[1]!.replace(/,/g, ''));
    const unit = (numMatch[2] ?? '').toLowerCase();
    if (/eur|euro/.test(unit)) currency = 'EUR';
    else if (/usd|dollar/.test(unit)) currency = 'USD';
    else if (/gbp|pound/.test(unit)) currency = 'GBP';
    else if (/jpy|yen/.test(unit)) currency = 'JPY';
  }
  if (!Number.isFinite(amount)) amount = 0;

  // Category.
  let category = 'other';
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(text)) {
      category = cat;
      break;
    }
  }

  // Payer — "<Name> paid" wins over "I paid" (which we leave for the user to pick).
  let paidByTravelerId: string | undefined;
  for (const t of travelers) {
    const re = new RegExp(`\\b${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s+paid`, 'i');
    if (re.test(text)) {
      paidByTravelerId = t.id;
      break;
    }
  }

  // Split targets — explicit names, "everyone/all", or default to all travelers.
  const mentioned = travelers.filter((t) =>
    new RegExp(`\\b${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
  );
  let splitTravelerIds: string[];
  if (/\b(everyone|all of us|the group|all)\b/i.test(text) || mentioned.length === 0) {
    splitTravelerIds = travelers.map((t) => t.id);
  } else {
    const set = new Set(mentioned.map((t) => t.id));
    if (paidByTravelerId) set.add(paidByTravelerId);
    splitTravelerIds = [...set];
  }

  // Description — strip the amount token, keep the rest, prefer an "at <place>" phrase.
  const atMatch = text.match(/\bat\s+([A-Z][\w' ]+?)(?:,|\.|$| split| paid)/i);
  const description = atMatch
    ? `${category === 'food' ? 'Meal' : category} at ${atMatch[1]!.trim()}`
    : text.replace(/([€$£¥])\s*[\d.,]+/, '').replace(/\bsplit.*$/i, '').trim() || `${category} expense`;

  const confidence = (amount > 0 ? 0.5 : 0) + (category !== 'other' ? 0.25 : 0) + (splitTravelerIds.length ? 0.25 : 0);

  return {
    draft: { amount, currency, category, description, paidByTravelerId, splitTravelerIds, confidence },
  };
}
