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

export const name = 'uploadDocument';
export const description = 'Upload a health document (lab PDF, clinical note, etc.) for background analysis. Fires the analyze-document hook.';

export interface Input {
  kind: string;
  filename: string;
  mime?: string;
  content: string;
}

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

export type Output = { documentId: string; status: 'pending' };

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.content || !input.content.trim()) {
    throw new HttpError(400, 'document content is required');
  }
  if (input.content.length > 200000) {
    throw new HttpError(400, 'document too large (max 200k chars)');
  }

  const created = (await ctx.db.insert('documents', {
    kind: input.kind,
    filename: input.filename,
    mime: input.mime ?? 'text/plain',
    content: input.content,
    status: 'pending',
  })) as Document;

  return { documentId: created.id, status: 'pending' };
}
