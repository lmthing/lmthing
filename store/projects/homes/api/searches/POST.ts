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

export const name = 'createSearch';
export const description = 'Create a new home search with its budget, constraints and commute targets. Captures drive the intake pipeline — this does not spawn anything.';

export interface CommuteTargetInput {
  label: string;
  address: string;
  mode: string;
  maxMinutes: number;
}

export interface Input {
  title: string;
  brief?: string;
  mode: string;
  budgetMax: number;
  currency?: string;
  area?: string;
  minRooms?: number;
  minAreaSqm?: number;
  mustHaves?: string[];
  commuteTargets?: CommuteTargetInput[];
}

export interface Search {
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
  commuteTargets: CommuteTargetInput[];
  status: string;
  createdAt: string;
}

export type Output = Search;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const search = (await ctx.db.insert('searches', {
    title: input.title,
    brief: input.brief,
    mode: input.mode,
    budgetMax: input.budgetMax,
    currency: input.currency ?? 'USD',
    area: input.area,
    minRooms: input.minRooms ?? 0,
    minAreaSqm: input.minAreaSqm ?? 0,
    mustHaves: input.mustHaves ?? [],
    commuteTargets: input.commuteTargets ?? [],
  })) as Output;

  return search;
}
