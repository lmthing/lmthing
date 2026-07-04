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

export const name = 'packingList';
export const description = 'List a trip\'s packing items, grouped by category then oldest-added first.';

export interface Input {
  id: string;
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

export interface Output {
  items: PackingItem[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const items = (await ctx.db.query('packing_items', {
    where: { tripId: input.id },
  })) as PackingItem[];

  items.sort((a, b) => {
    const byCategory = (a.category ?? '').localeCompare(b.category ?? '');
    if (byCategory !== 0) return byCategory;
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });

  return { items };
}
