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

export const name = 'getDocument';
export const description = 'Get a document by id, with its extractions and generated knowledge notes hydrated.';

export interface Input {
  id: string;
}

interface DocumentExtraction {
  id: string;
  documentId: string;
  targetTable: string;
  rowId: string;
  confidence: number;
  createdAt: string;
}

interface KnowledgeNote {
  id: string;
  topic: string;
  body: string;
  sourceKind: string;
  documentId?: string;
  analyte?: string;
  tag?: string;
  createdAt: string;
}

interface Document {
  id: string;
  kind: string;
  filename: string;
  mime: string;
  content: string;
  status: string;
  summary?: string;
  error?: string;
  uploadedAt: string;
  extractions: DocumentExtraction[];
  notes: KnowledgeNote[];
}

export type Output = Document;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('documents', {
    where: { id: input.id },
    include: ['extractions', 'notes'],
  })) as Document[];

  const doc = rows[0];
  if (!doc) {
    throw new HttpError(404, 'document not found');
  }

  doc.extractions = doc.extractions ?? [];
  doc.notes = doc.notes ?? [];

  return doc;
}
