// Imperative, no-LLM cron handler — was a declarative trigger delegating to
// finance/treasurer#refresh-rates (an agent session that did a webSearch per
// currency pair). FX lookup is fully
// deterministic, so this now self-scans the same currency pairs the treasurer used
// to (every expense currency that differs from its trip's homeCurrency) and fetches
// live rates directly from the free open.er-api.com JSON API — no agent session, no
// LLM tokens spent on a daily housekeeping task. The treasurer's `refresh-rates`
// action (spaces/finance/agents/treasurer/instruct.md) is left intact for ad-hoc
// chat use; this hook no longer calls it.
type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown> }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const API_BASE = 'https://open.er-api.com/v6/latest';

export default {
  type: 'cron',
  every: '24h',
  budget: { maxWallClockMs: 120000 },
  handler: async ({ db }: { db: Db }) => {
    try {
      // Self-scan: gather every (expense currency -> trip home currency) pair
      // actually in use — the same scan the treasurer's `refresh-rates` action did.
      const trips = await db.query('trips');
      const expenses = await db.query('expenses');
      const rates = await db.query('currency_rates');

      const pairs = new Set<string>();
      for (const trip of trips) {
        const homeCurrency = trip.homeCurrency as string | undefined;
        if (!homeCurrency) continue;
        const tripExpenses = expenses.filter((e) => e.tripId === trip.id);
        for (const e of tripExpenses) {
          const currency = e.currency as string | undefined;
          if (currency && currency !== homeCurrency) pairs.add(`${currency}->${homeCurrency}`);
        }
      }
      if (pairs.size === 0) return;

      // Skip pairs with a rate cached within the last day — no need to re-fetch.
      const stale = [...pairs].filter((pair) => {
        const [base, quote] = pair.split('->');
        const cached = rates.filter((r) => r.base === base && r.quote === quote);
        const fresh = cached.some((r) => {
          const fetchedAt = r.fetchedAt as string | undefined;
          return fetchedAt && Date.now() - new Date(fetchedAt).getTime() < DAY_MS;
        });
        return !fresh;
      });
      if (stale.length === 0) return;

      // Group by base — open.er-api.com returns every quote rate for a base in one
      // call, so a base with several stale quotes is fetched only once.
      const basesNeeded = new Map<string, string[]>();
      for (const pair of stale) {
        const [base, quote] = pair.split('->');
        const quotes = basesNeeded.get(base) ?? [];
        quotes.push(quote);
        basesNeeded.set(base, quotes);
      }

      for (const [base, quotes] of basesNeeded) {
        let payload: { rates?: Record<string, unknown> } | undefined;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(base)}`, { signal: controller.signal });
            if (!res.ok) continue; // tolerant: skip this base, keep whatever's cached
            payload = (await res.json()) as { rates?: Record<string, unknown> };
          } finally {
            clearTimeout(timer);
          }
        } catch {
          continue; // network/timeout failure — never throw, just skip this base
        }

        const liveRates = payload?.rates;
        if (!liveRates || typeof liveRates !== 'object') continue;

        for (const quote of quotes) {
          const rate = liveRates[quote];
          if (typeof rate !== 'number' || !Number.isFinite(rate)) continue; // never write a guess

          const fetchedAt = new Date().toISOString();
          const existing = await db.query('currency_rates', { where: { base, quote } });
          if (existing.length > 0) {
            await db.update('currency_rates', {
              where: { base, quote },
              set: { rate, source: 'open.er-api.com', fetchedAt },
            });
          } else {
            await db.insert('currency_rates', { base, quote, rate, source: 'open.er-api.com', fetchedAt });
          }
        }
      }
    } catch (err) {
      // Belt-and-braces: a housekeeping cron must never crash the pod's hook runner.
      console.error('[refresh-currency-rates] unexpected failure, keeping old rates:', err);
    }
  },
};
