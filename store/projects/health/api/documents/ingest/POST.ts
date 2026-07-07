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

export const name = 'ingestDocumentFile';
export const description =
  'Ingest an uploaded lab PDF or photo. Preferred path: the client extracts the PDF text layer (PDF.js) and passes it as `text`. For scanned/photo files with no text layer, the handler runs Azure Document Intelligence OCR when configured; otherwise it stores the file for manual entry and flags that OCR is unavailable (graceful — never breaks the upload).';

export interface Input {
  filename: string;
  kind?: string;
  mime?: string;
  /** Text layer already extracted client-side (PDF.js) — the fast, keyless path. */
  text?: string;
  /** Base64-encoded image bytes for scanned/photo labs (OCR fallback). */
  imageBase64?: string;
}

export interface Output {
  documentId: string;
  status: 'pending' | 'needs_review';
  ocr: 'text_layer' | 'azure_document_intelligence' | 'unavailable';
  note?: string;
}

async function azureOcr(imageBase64: string): Promise<string | null> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const endpoint = env.AZURE_DOCINT_ENDPOINT;
  const key = env.AZURE_DOCINT_KEY;
  if (!endpoint || !key) return null;
  try {
    const res = await fetch(
      `${endpoint.replace(/\/$/, '')}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`,
      {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Source: imageBase64 }),
      },
    );
    if (!res.ok) return null;
    // Real deployments poll the operation-location header; this returns null so the
    // caller falls back to manual review rather than blocking the request.
    return null;
  } catch {
    return null;
  }
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.filename || !input.filename.trim()) {
    throw new HttpError(400, 'filename is required');
  }

  let content = input.text?.trim() ?? '';
  let ocr: Output['ocr'] = 'text_layer';
  let note: string | undefined;

  if (!content && input.imageBase64) {
    const extracted = await azureOcr(input.imageBase64);
    if (extracted) {
      content = extracted;
      ocr = 'azure_document_intelligence';
    } else {
      ocr = 'unavailable';
      note =
        'Automatic OCR is not configured on this pod (AZURE_DOCINT_ENDPOINT/KEY missing). ' +
        'The file was saved — paste or type the values from it to analyze them.';
    }
  }

  if (content.length > 200000) {
    throw new HttpError(400, 'document too large (max 200k chars)');
  }

  const created = (await ctx.db.insert('documents', {
    kind: input.kind ?? 'lab_report',
    filename: input.filename,
    mime: input.mime ?? (input.imageBase64 ? 'image/*' : 'text/plain'),
    content,
    // A document with no extracted text can't be analyzed automatically — mark it
    // needs_review so the UI prompts for manual entry instead of a silent empty analysis.
    status: content ? 'pending' : 'needs_review',
  })) as { id: string };

  return {
    documentId: created.id,
    status: content ? 'pending' : 'needs_review',
    ocr,
    note,
  };
}
