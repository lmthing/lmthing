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

export const name = 'tripList';
export const description = 'List all trips, most recently created first.';

export interface Input {}

export interface Trip {
  id: string;
  title: string;
  brief: string;
  startDate: string;
  endDate: string;
  status: string;
  budgetUsd: number;
  createdAt: string;
}

export type Output = Trip[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const trips = (await ctx.db.query('trips')) as Trip[];

  trips.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return trips;
}
