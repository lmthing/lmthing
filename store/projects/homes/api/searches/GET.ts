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

export const name = 'searchList';
export const description = 'List all home searches, most recently created first, with unread alert and new listing counts.';

export interface Input {}

interface CommuteTarget {
  label: string;
  address: string;
  mode: string;
  maxMinutes: number;
}

interface Search {
  id: string;
  title: string;
  brief?: string;
  mode: string;
  area?: string;
  budgetMax: number;
  budgetMin: number;
  currency: string;
  minRooms: number;
  minAreaSqm: number;
  mustHaves: string[];
  commuteTargets: CommuteTarget[];
  status: string;
  createdAt: string;
}

interface Alert {
  id: string;
  searchId: string;
  read: boolean;
}

interface Listing {
  id: string;
  searchId: string;
  status: string;
  score: number;
}

interface SearchStats {
  unreadAlerts: number;
  newListings: number;
  tracked: number;
  shortlisted: number;
  bestScore: number;
  lastCaptureAt?: string;
}

export type Output = (Search & SearchStats)[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const searches = (await ctx.db.query('searches')) as Search[];

  searches.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  // Query the big tables once and index in memory (equality-only where means a
  // per-search query per table would be N round-trips for no benefit).
  const allAlerts = (await ctx.db.query('alerts')) as Alert[];
  const allListings = (await ctx.db.query('listings')) as Listing[];
  const allCaptures = (await ctx.db.query('raw_captures')) as { searchId: string; capturedAt?: string }[];

  const result: Output = [];
  for (const search of searches) {
    const alerts = allAlerts.filter((a) => a.searchId === search.id);
    const listings = allListings.filter((l) => l.searchId === search.id);
    const live = listings.filter((l) => l.status !== 'dismissed' && l.status !== 'gone');
    const captures = allCaptures.filter((c) => c.searchId === search.id);

    const lastCaptureAt = captures
      .map((c) => c.capturedAt ?? '')
      .filter(Boolean)
      .sort()
      .slice(-1)[0];

    result.push({
      ...search,
      unreadAlerts: alerts.filter((a) => a.read === false).length,
      newListings: listings.filter((l) => l.status === 'new').length,
      tracked: live.length,
      shortlisted: listings.filter((l) => l.status === 'shortlisted').length,
      bestScore: live.reduce((m, l) => Math.max(m, l.score ?? 0), 0),
      lastCaptureAt: lastCaptureAt || undefined,
    });
  }

  return result;
}
