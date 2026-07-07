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

export const name = 'getRates';
export const description = 'Current reference rates the surveyor cites for the true-cost promise: FX (exchangerate.host, keyless) to normalize a cross-currency budget, plus an indicative mortgage rate. FX degrades gracefully to no-conversion; the mortgage rate falls back to a labelled baked default so trueCost always has a cited rateSource.';

export interface Input {
  /** ISO base currency for the FX table, e.g. "EUR". */
  base?: string;
  /** ISO currencies to fetch, comma-separated, e.g. "USD,GBP". */
  symbols?: string;
}

export interface Output {
  base: string;
  /** currency → units per 1 base; empty when FX is unavailable. */
  fx: Record<string, number>;
  /** indicative annual mortgage rate %, always present (live or baked). */
  mortgageRatePct: number;
  rateSource: string;
  degraded: boolean;
}

// Labelled fallback — used when a live feed is unavailable so trueCost still
// cites *a* source rather than a silent magic constant.
const BAKED_MORTGAGE_PCT = 3.6;
const BAKED_SOURCE = 'indicative euro-area avg (baked fallback — configure a live feed for accuracy)';

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  void ctx;
  const base = (input.base || 'EUR').toUpperCase();
  const symbols = (input.symbols || 'USD,GBP,EUR')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && s !== base);

  const out: Output = {
    base,
    fx: {},
    mortgageRatePct: BAKED_MORTGAGE_PCT,
    rateSource: BAKED_SOURCE,
    degraded: false,
  };

  try {
    const params = new URLSearchParams({ base, symbols: symbols.join(',') });
    const res = await fetch(`https://api.exchangerate.host/latest?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      if (data.rates) out.fx = data.rates;
      else out.degraded = true;
    } else {
      out.degraded = true;
    }
  } catch {
    out.degraded = true;
  }

  // A live mortgage-rate feed needs a keyed provider; when MORTGAGE_RATE_PCT is
  // set in the pod env we cite it, otherwise the labelled baked default stands.
  const envRate = Number(process.env.MORTGAGE_RATE_PCT);
  if (Number.isFinite(envRate) && envRate > 0) {
    out.mortgageRatePct = envRate;
    out.rateSource = 'configured MORTGAGE_RATE_PCT (pod env)';
  }

  return out;
}
