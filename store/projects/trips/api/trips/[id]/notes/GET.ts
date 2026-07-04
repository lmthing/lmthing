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

export const name = 'tripNotes';
export const description = 'List a trip\'s knowledge notes, most recently written first.';

export interface Input {
  id: string;
}

export interface KnowledgeNote {
  id: string;
  tripId?: string;
  destinationId?: string;
  topic: string;
  body?: string;
  sourceKind: string;
  documentId?: string;
  createdAt: string;
}

export interface Output {
  notes: KnowledgeNote[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const notes = (await ctx.db.query('knowledge_notes', {
    where: { tripId: input.id },
  })) as KnowledgeNote[];

  notes.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return { notes };
}
