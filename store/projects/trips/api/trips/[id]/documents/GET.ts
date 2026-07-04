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
export const description = 'List a trip\'s uploaded documents, most recently uploaded first.';

export interface Input {
  id: string;
}

export interface Document {
  id: string;
  tripId: string;
  kind: string;
  filename?: string;
  status: string;
  summary?: string;
  error?: string;
  uploadedAt: string;
}

export interface Output {
  documents: Document[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const documents = (await ctx.db.query('documents', {
    where: { tripId: input.id },
  })) as Document[];

  documents.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));

  return { documents };
}
