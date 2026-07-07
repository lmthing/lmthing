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

export const name = 'listingFeed';
export const description = 'List the canonical listings tracked for a search, ranked by score then recency. Dismissed and gone listings are excluded unless explicitly requested via status.';

export interface Input {
  id: string;
  status?: string;
  minScore?: number;
}

interface CostBreakdownItem {
  label: string;
  amount: number;
  basis: string;
  note?: string;
}

interface PhotoItem {
  url: string;
  caption?: string;
}

export interface Listing {
  id: string;
  searchId: string;
  dedupeKey: string;
  title: string;
  url?: string;
  portal?: string;
  priceAmount: number;
  currency: string;
  trueCostMonthly: number;
  costBreakdown?: CostBreakdownItem[];
  address?: string;
  claimedLat?: number;
  claimedLng?: number;
  areaSqm: number;
  measuredAreaSqm: number;
  rooms: number;
  bedrooms: number;
  floor?: string;
  yearBuilt: number;
  description?: string;
  photoUrls?: PhotoItem[];
  flags?: string[];
  score: number;
  scoreSummary?: string;
  status: string;
  dismissedReason?: string;
  firstSeenAt: string;
  lastSeenAt?: string;
}

export type Output = Listing[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  let listings = (await ctx.db.query('listings', { where: { searchId: input.id } })) as Listing[];

  if (input.status !== undefined) {
    listings = listings.filter((l) => l.status === input.status);
  } else {
    listings = listings.filter((l) => l.status !== 'dismissed' && l.status !== 'gone');
  }

  if (input.minScore !== undefined) {
    listings = listings.filter((l) => (l.score ?? 0) >= (input.minScore as number));
  }

  listings.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? '');
  });

  return listings;
}
