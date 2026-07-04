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
export const description = 'Get a document with the extractions it produced (each with the row it wrote, if still present) and any notes it produced.';

export interface Input {
  id: string;
}

export interface Document {
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

export interface Extraction {
  id: string;
  documentId: string;
  table: string;
  rowId: string;
  confidence: number;
  createdAt: string;
}

export interface Note {
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
  document: Document;
  extractions: (Extraction & { row?: Row })[];
  notes: Note[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const documentRows = (await ctx.db.query('documents', { where: { id: input.id } })) as Document[];
  const document = documentRows[0];
  if (!document) {
    throw new HttpError(404, 'document not found');
  }

  const extractionRows = (await ctx.db.query('document_extractions', {
    where: { documentId: input.id },
  })) as Extraction[];

  const notes = (await ctx.db.query('knowledge_notes', {
    where: { documentId: input.id },
  })) as Note[];

  const extractions: (Extraction & { row?: Row })[] = [];
  for (const extraction of extractionRows) {
    let row: Row | undefined;
    try {
      const rows = await ctx.db.query(extraction.table);
      row = rows.find((r) => r.id === extraction.rowId);
    } catch {
      row = undefined;
    }
    extractions.push({ ...extraction, row });
  }

  return { document, extractions, notes };
}
