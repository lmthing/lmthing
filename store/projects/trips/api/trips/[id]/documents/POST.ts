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

export const name = 'uploadDocument';
export const description = 'Upload a trip document (pasted booking confirmation, itinerary, ticket, etc). Triggers the analyze-document hook automatically.';

export interface Input {
  id: string;
  content: string;
  kind?: string;
  filename?: string;
  mime?: string;
  sourceUrl?: string;
}

export interface Output {
  id: string;
  tripId: string;
  kind: string;
  filename?: string;
  mime?: string;
  content?: string;
  sourceUrl?: string;
  status: string;
  summary?: string;
  error?: string;
  uploadedAt: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const document = (await ctx.db.insert('documents', {
    tripId: input.id,
    content: input.content,
    kind: input.kind ?? 'other',
    filename: input.filename,
    mime: input.mime,
    sourceUrl: input.sourceUrl,
    status: 'pending',
  })) as Output;

  return document;
}
