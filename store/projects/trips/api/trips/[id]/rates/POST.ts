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

export const name = 'refreshRates';
export const description =
  'Fetch live FX rates from exchangerate.host (free, keyless) for every currency present on the trip and cache them in currency_rates. Falls back to the cached rates when the network is unavailable so finances always have a number.';

export interface Input {
  id: string;
}

export interface Rate {
  base: string;
  quote: string;
  rate: number;
  source: string;
  fetchedAt: string;
}

export interface Output {
  base: string;
  rates: Rate[];
  live: boolean;
}

interface Trip {
  id: string;
  homeCurrency?: string;
}

function distinctCurrencies(rows: Array<{ currency?: string }>): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.currency) set.add(String(r.currency).toUpperCase());
  return [...set];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const trips = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const base = (trips[0]?.homeCurrency ?? 'USD').toUpperCase();

  const expenses = (await ctx.db.query('expenses', { where: { tripId: input.id } })) as Array<{ currency?: string }>;
  const quotes = distinctCurrencies(expenses).filter((c) => c !== base);

  if (quotes.length === 0) {
    return { base, rates: [], live: false };
  }

  const fetchedAt = new Date().toISOString();
  try {
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${quotes.join(',')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const body = (await res.json()) as { rates?: Record<string, number> };
    const map = body.rates ?? {};
    const out: Rate[] = [];
    for (const quote of quotes) {
      const rate = Number(map[quote]);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      // Upsert: remove any prior cached pair, then insert the fresh one.
      await ctx.db.remove('currency_rates', { where: { base, quote } });
      await ctx.db.insert('currency_rates', { base, quote, rate, source: 'exchangerate.host', fetchedAt });
      out.push({ base, quote, rate, source: 'exchangerate.host', fetchedAt });
    }
    if (out.length) return { base, rates: out, live: true };
  } catch {
    // Fall through to cached values below.
  }

  // Graceful fallback — return whatever we already cached so the UI still has rates.
  const cached = (await ctx.db.query('currency_rates', { where: { base } })) as unknown as Rate[];
  return { base, rates: cached, live: false };
}
