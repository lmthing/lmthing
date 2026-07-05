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

export const name = 'listContacts';
export const description = 'List care team contacts, alphabetically by name.';

export interface Input {}

export interface CareContact {
  id: string;
  name: string;
  role: string;
  organization?: string;
  phone?: string;
  email?: string;
  note?: string;
  createdAt: string;
}

export type Output = CareContact[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('care_contacts')) as CareContact[];

  rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  return rows;
}
