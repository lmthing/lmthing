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

export const name = 'sourceHealth';
export const description = 'List rolling fetch-reliability metrics for every source, joined with the source it describes.';

export interface Input {}

export interface SourceHealth {
  id: string;
  sourceId: string;
  fetchCount: number;
  itemCount: number;
  errorCount: number;
  lastError: string;
  lastStatus: string;
  successRate: number;
  updatedAt: string;
}

export type Output = (SourceHealth & { source: unknown })[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const healthRows = (await ctx.db.query('source_health')) as SourceHealth[];
  const sources = (await ctx.db.query('sources')) as Row[];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return healthRows.map((h) => ({
    ...h,
    source: sourceById.get(h.sourceId) ?? null,
  }));
}
