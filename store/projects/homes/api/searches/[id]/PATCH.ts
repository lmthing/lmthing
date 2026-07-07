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

import { HttpError } from '@app/runtime';

export const name = 'updateSearch';
export const description = 'Update fields on a home search.';

export interface CommuteTargetInput {
  label: string;
  address: string;
  mode: string;
  maxMinutes: number;
}

export interface Input {
  id: string;
  title?: string;
  brief?: string;
  mode?: string;
  area?: string;
  budgetMax?: number;
  budgetMin?: number;
  currency?: string;
  minRooms?: number;
  minAreaSqm?: number;
  mustHaves?: string[];
  commuteTargets?: CommuteTargetInput[];
  status?: string;
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
  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.brief !== undefined) set.brief = input.brief;
  if (input.mode !== undefined) set.mode = input.mode;
  if (input.area !== undefined) set.area = input.area;
  if (input.budgetMax !== undefined) set.budgetMax = input.budgetMax;
  if (input.budgetMin !== undefined) set.budgetMin = input.budgetMin;
  if (input.currency !== undefined) set.currency = input.currency;
  if (input.minRooms !== undefined) set.minRooms = input.minRooms;
  if (input.minAreaSqm !== undefined) set.minAreaSqm = input.minAreaSqm;
  if (input.mustHaves !== undefined) set.mustHaves = input.mustHaves;
  if (input.commuteTargets !== undefined) set.commuteTargets = input.commuteTargets;
  if (input.status !== undefined) set.status = input.status;

  await ctx.db.update('searches', { where: { id: input.id }, set });

  const rows = (await ctx.db.query('searches', { where: { id: input.id } })) as Search[];
  const search = rows[0];
  if (!search) {
    throw new HttpError(404, 'search not found');
  }

  return search;
}
