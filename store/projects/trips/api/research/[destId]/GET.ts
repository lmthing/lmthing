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

export const name = 'getResearch';
export const description = 'List research reports for a destination, most recently created first.';

export interface Input {
  destId: string;
}

export interface Research {
  id: string;
  tripId: string;
  destinationId?: string;
  topic: string;
  body?: string;
  status: string;
  createdAt: string;
}

export type Output = Research[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const research = (await ctx.db.query('research', {
    where: { destinationId: input.destId },
  })) as Research[];

  research.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return research;
}
