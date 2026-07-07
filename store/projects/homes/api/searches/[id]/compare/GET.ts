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

export const name = 'compareListings';
export const description = 'Compare a set of listings from a search side by side — cost, size, rooms, commutes, flags and score.';

export interface Input {
  id: string;
  ids: string;
}

export interface ComparisonRow {
  attribute: string;
  values: (string | number)[];
}

export interface Output {
  /** the picked listings' titles, in the requested id order — column headers for the compare table */
  titles: string[];
  rows: ComparisonRow[];
}

interface CommuteTarget {
  label: string;
  address: string;
  mode: string;
  maxMinutes: number;
}

interface Search {
  id: string;
  commuteTargets: CommuteTarget[];
}

interface Commute {
  id: string;
  listingId: string;
  targetLabel: string;
  mode: string;
  minutes: number;
}

interface Listing {
  id: string;
  searchId: string;
  title: string;
  priceAmount: number;
  trueCostMonthly: number;
  areaSqm: number;
  measuredAreaSqm: number;
  rooms: number;
  bedrooms: number;
  floor?: string;
  yearBuilt: number;
  flags?: string[];
  score: number;
  commutes?: Commute[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const ids = input.ids
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const listings: Listing[] = [];
  for (const id of ids) {
    const rows = (await ctx.db.query('listings', {
      where: { id },
      include: ['commutes'],
    })) as Listing[];
    if (rows[0]) listings.push(rows[0]);
  }

  const searchRows = (await ctx.db.query('searches', { where: { id: input.id } })) as Search[];
  const commuteTargets = searchRows[0]?.commuteTargets ?? [];

  const titles = listings.map((l) => l.title);
  const rows: ComparisonRow[] = [];

  rows.push({ attribute: 'True cost/mo', values: listings.map((l) => l.trueCostMonthly ?? 0) });

  rows.push({ attribute: 'Stated price', values: listings.map((l) => l.priceAmount ?? 0) });

  rows.push({
    attribute: '€/m²',
    values: listings.map((l) => {
      const size = l.measuredAreaSqm || l.areaSqm || 0;
      const cost = l.trueCostMonthly || l.priceAmount || 0;
      return size > 0 ? Math.round((cost / size) * 100) / 100 : 0;
    }),
  });

  rows.push({ attribute: 'Measured size', values: listings.map((l) => l.measuredAreaSqm ?? 0) });

  rows.push({ attribute: 'Stated size', values: listings.map((l) => l.areaSqm ?? 0) });

  rows.push({
    attribute: 'Rooms/Bedrooms',
    values: listings.map((l) => `${l.rooms ?? 0}/${l.bedrooms ?? 0}`),
  });

  rows.push({ attribute: 'Floor', values: listings.map((l) => l.floor ?? '—') });

  rows.push({
    attribute: 'Year built',
    values: listings.map((l) => (l.yearBuilt ? l.yearBuilt : '—')),
  });

  for (const target of commuteTargets) {
    rows.push({
      attribute: target.label,
      values: listings.map((l) => {
        const commute = (l.commutes ?? []).find((c) => c.targetLabel === target.label);
        return commute ? commute.minutes : '—';
      }),
    });
  }

  rows.push({
    attribute: 'Flags',
    values: listings.map((l) => (l.flags && l.flags.length ? l.flags.join(', ') : '—')),
  });

  rows.push({ attribute: 'Score', values: listings.map((l) => l.score ?? 0) });

  return { titles, rows };
}
