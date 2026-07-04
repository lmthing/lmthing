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
export const description = 'List raised subscription alerts, newest first; optionally only unread ones.';

export interface Input {
  unreadOnly?: boolean;
}

export interface Alert {
  id: string;
  subscriptionId: string;
  articleId: string | null;
  title: string;
  summary: string;
  read: boolean;
  createdAt: string;
}

export type Output = Alert[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('alerts')) as Alert[];

  const filtered = input.unreadOnly ? rows.filter((a) => a.read !== true) : rows;

  return [...filtered].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}
