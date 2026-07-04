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

export const name = 'addIngredient';
export const description = 'Add a pantry ingredient, or return the existing one if the name is already tracked.';

export interface Input {
  name: string;
  unit: string;
  quantity?: number;
  category?: string;
  lowStockThreshold?: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export type Output = Ingredient;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const existing = (await ctx.db.query('ingredients', {
    where: { name: input.name },
  })) as Ingredient[];

  if (existing[0]) {
    return existing[0];
  }

  const created = (await ctx.db.insert('ingredients', {
    name: input.name,
    unit: input.unit,
    quantity: input.quantity ?? 0,
    category: input.category,
    lowStockThreshold: input.lowStockThreshold ?? 0,
  })) as Ingredient;

  return created;
}
