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

export const name = 'listDocuments';
export const description = 'List uploaded health documents, most recently uploaded first.';

export interface Input {}

export interface Document {
  id: string;
  kind: string;
  filename: string;
  mime: string;
  content: string;
  status: string;
  summary?: string;
  error?: string;
  uploadedAt: string;
}

export type Output = Document[];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('documents')) as Document[];

  rows.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));

  return rows;
}
