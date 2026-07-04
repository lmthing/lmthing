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

export const name = 'listKnowledgeNotes';
export const description = 'List generated knowledge base notes, optionally filtered by analyte and/or tag, most recently created first.';

export interface Input {
  analyte?: string;
  tag?: string;
}

export interface KnowledgeNote {
  id: string;
  topic: string;
  body: string;
  sourceKind: string;
  documentId?: string;
  analyte?: string;
  tag?: string;
  createdAt: string;
}

export type Output = KnowledgeNote[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('knowledge_notes')) as KnowledgeNote[];

  const filtered = rows.filter((n) => {
    if (input.analyte && n.analyte !== input.analyte) return false;
    if (input.tag && n.tag !== input.tag) return false;
    return true;
  });

  filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return filtered;
}
