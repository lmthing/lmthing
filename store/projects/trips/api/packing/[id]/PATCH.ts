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

export const name = 'togglePacked';
export const description = 'Toggle (or explicitly set) whether a packing item has been packed.';

export interface Input {
  id: string;
  packed?: boolean;
}

export interface PackingItem {
  id: string;
  tripId: string;
  label: string;
  category: string;
  reason?: string;
  packed: boolean;
  createdAt: string;
}

export type Output = PackingItem;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('packing_items', { where: { id: input.id } })) as PackingItem[];
  const current = rows[0];
  if (!current) {
    throw new HttpError(404, 'packing item not found');
  }

  const packed = input.packed !== undefined ? input.packed : !current.packed;

  await ctx.db.update('packing_items', { where: { id: input.id }, set: { packed } });

  const updatedRows = (await ctx.db.query('packing_items', { where: { id: input.id } })) as PackingItem[];
  const item = updatedRows[0];
  if (!item) {
    throw new HttpError(404, 'packing item not found');
  }

  return item;
}
