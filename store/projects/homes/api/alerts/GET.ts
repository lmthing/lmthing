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

export const name = 'listAllAlerts';
export const description = 'Every alert across ALL active searches, unread first then newest — powers the global bell + popover so the user acts before someone else does.';

export interface Input {
  unreadOnly?: boolean;
  limit?: number;
}

export interface AlertWithContext {
  id: string;
  searchId: string;
  searchTitle: string;
  listingId?: string;
  listingTitle?: string;
  kind: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

export interface Output {
  alerts: AlertWithContext[];
  unreadCount: number;
}

interface Search {
  id: string;
  title: string;
  status: string;
}
interface Alert {
  id: string;
  searchId: string;
  listingId?: string;
  kind: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}
interface Listing {
  id: string;
  title: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const searches = (await ctx.db.query('searches')) as Search[];
  const searchTitle = new Map(searches.map((s) => [s.id, s.title]));

  const alerts = (await ctx.db.query('alerts')) as Alert[];

  // Resolve listing titles once (equality-only where means we query the whole
  // table and index in memory rather than a per-alert join).
  const listings = (await ctx.db.query('listings')) as Listing[];
  const listingTitle = new Map(listings.map((l) => [l.id, l.title]));

  let rows: AlertWithContext[] = alerts.map((a) => ({
    id: a.id,
    searchId: a.searchId,
    searchTitle: searchTitle.get(a.searchId) ?? 'a search',
    listingId: a.listingId,
    listingTitle: a.listingId ? listingTitle.get(a.listingId) : undefined,
    kind: a.kind,
    title: a.title,
    body: a.body,
    read: a.read === true,
    createdAt: a.createdAt,
  }));

  const unreadCount = rows.filter((a) => !a.read).length;

  if (input.unreadOnly) rows = rows.filter((a) => !a.read);

  // Unread first, then newest.
  rows.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });

  if (input.limit && input.limit > 0) rows = rows.slice(0, input.limit);

  return { alerts: rows, unreadCount };
}
