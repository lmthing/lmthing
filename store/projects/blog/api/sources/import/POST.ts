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

export const name = 'importOpml';
export const description = 'Bulk-import RSS sources from an OPML document, skipping feeds whose url is already subscribed.';

export interface Input {
  opml: string;
}

export interface Output {
  imported: number;
  skipped: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#0*38;|&amp;/g, '&');
}

function attr(tag: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = tag.match(re);
  return m ? decodeEntities(m[1] ?? m[2] ?? '').trim() : '';
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (typeof input.opml !== 'string' || input.opml.trim() === '') {
    throw new HttpError(400, 'opml body is required');
  }

  // collect existing feed urls to dedupe (equality-only where would not help across many)
  const existing = (await ctx.db.query('sources')) as Row[];
  const known = new Set(existing.map((s) => String(s.value)));

  let imported = 0;
  let skipped = 0;

  const outlineRe = /<outline\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = outlineRe.exec(input.opml)) !== null) {
    const tag = m[0];
    const xmlUrl = attr(tag, 'xmlUrl') || attr(tag, 'xmlurl');
    if (!xmlUrl) continue; // container outlines have no feed url

    if (known.has(xmlUrl)) {
      skipped += 1;
      continue;
    }

    const title = attr(tag, 'title') || attr(tag, 'text') || xmlUrl;
    try {
      await ctx.db.insert('sources', {
        kind: 'rss',
        value: xmlUrl,
        label: title,
        topics: [],
        active: true,
      });
      known.add(xmlUrl);
      imported += 1;
    } catch {
      // unique(value) violation — raced/duplicate within the file
      skipped += 1;
    }
  }

  return { imported, skipped };
}
