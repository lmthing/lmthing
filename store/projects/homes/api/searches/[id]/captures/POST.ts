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

export const name = 'ingestCapture';
export const description = 'The entry point: paste an alert email body, saved-search page text, or a bare link. Fires the clipper parse hook — do not spawn here.';

export interface Input {
  id: string;
  content: string;
  sourceUrl?: string;
  sourceId?: string;
}

export interface Output {
  captureId: string;
  status: 'pending';
}

interface Source {
  id: string;
  searchId: string;
}

interface RawCapture {
  id: string;
  sourceId: string;
  searchId: string;
  content: string;
  sourceUrl?: string;
  status: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  let sourceId = input.sourceId;

  if (!sourceId) {
    const source = (await ctx.db.insert('sources', {
      searchId: input.id,
      kind: 'manual',
      label: 'Pasted by hand',
    })) as Source;
    sourceId = source.id;
  }

  const capture = (await ctx.db.insert('raw_captures', {
    sourceId,
    searchId: input.id,
    content: input.content,
    sourceUrl: input.sourceUrl,
    status: 'pending',
  })) as RawCapture;

  return { captureId: capture.id, status: 'pending' };
}
