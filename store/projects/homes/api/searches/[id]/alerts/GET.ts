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

export const name = 'listAlerts';
export const description = 'List alerts raised for a search, newest first.';

export interface Input {
  id: string;
  unreadOnly?: boolean;
}

export interface Alert {
  id: string;
  searchId: string;
  listingId?: string;
  kind: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

export type Output = Alert[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  let alerts = (await ctx.db.query('alerts', { where: { searchId: input.id } })) as Alert[];

  if (input.unreadOnly) {
    alerts = alerts.filter((a) => a.read === false);
  }

  alerts.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return alerts;
}
