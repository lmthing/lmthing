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
}

export type Output = (Search & { unreadAlerts: number; newListings: number })[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const searches = (await ctx.db.query('searches')) as Search[];

  searches.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const result: Output = [];
  for (const search of searches) {
    const alerts = (await ctx.db.query('alerts', { where: { searchId: search.id } })) as Alert[];
    const unreadAlerts = alerts.filter((a) => a.read === false).length;

    const listings = (await ctx.db.query('listings', { where: { searchId: search.id } })) as Listing[];
    const newListings = listings.filter((l) => l.status === 'new').length;

    result.push({ ...search, unreadAlerts, newListings });
  }

  return result;
}
