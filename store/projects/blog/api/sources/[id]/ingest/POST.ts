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

export const name = 'ingestRss';
export const description = 'Fetch and parse a source RSS/Atom feed, inserting new raw items (deduped by url) and updating the source health metrics.';

export interface Input {
  id: string;
}

export interface Output {
  inserted: number;
  skipped: number;
  status: 'ok' | 'error';
  error?: string;
}

interface Source {
  id: string;
  kind: string;
  value: string;
  label: string;
}

interface SourceHealth {
  id: string;
  sourceId: string;
  fetchCount: number;
  itemCount: number;
  errorCount: number;
  lastError: string | null;
  lastStatus: string;
  successRate: number;
}

interface ParsedEntry {
  title: string;
  url: string;
  excerpt: string;
  imageUrl: string;
}

// --- tiny inline XML helpers (no DOM, no npm lib) ---

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#0*38;|&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// pull the inner text of the first <tag>...</tag> occurrence inside a block
function tagText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : '';
}

// pull an attribute value from the first matching self-closing/opening tag
function tagAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1] ?? m[2] ?? '').trim() : '';
}

function parseFeed(xml: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];

  // RSS <item>
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = stripTags(tagText(block, 'title'));
    const link = tagText(block, 'link') || tagAttr(block, 'link', 'href');
    const url = decodeEntities(link).trim();
    if (!url) continue;
    const excerpt = stripTags(tagText(block, 'description') || tagText(block, 'content:encoded'));
    const imageUrl = tagAttr(block, 'enclosure', 'url') || tagAttr(block, 'media:content', 'url') || tagAttr(block, 'media:thumbnail', 'url');
    entries.push({ title: title || url, url, excerpt, imageUrl });
  }

  // Atom <entry>
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title = stripTags(tagText(block, 'title'));
    // prefer <link href> (rel="alternate" or first), fall back to <link>text
    const url = decodeEntities(tagAttr(block, 'link', 'href') || tagText(block, 'link')).trim();
    if (!url) continue;
    const excerpt = stripTags(tagText(block, 'summary') || tagText(block, 'content'));
    const imageUrl = tagAttr(block, 'media:content', 'url') || tagAttr(block, 'media:thumbnail', 'url');
    entries.push({ title: title || url, url, excerpt, imageUrl });
  }

  return entries;
}

async function recordHealth(
  ctx: Ctx,
  sourceId: string,
  patch: { insertedCount: number; ok: boolean; error?: string },
): Promise<void> {
  const existing = (await ctx.db.query('source_health', { where: { sourceId } })) as SourceHealth[];
  const cur = existing[0];

  const fetchCount = (cur?.fetchCount ?? 0) + 1;
  const itemCount = (cur?.itemCount ?? 0) + patch.insertedCount;
  const errorCount = (cur?.errorCount ?? 0) + (patch.ok ? 0 : 1);
  const successRate = fetchCount > 0 ? (fetchCount - errorCount) / fetchCount : 1;

  const set: Row = {
    fetchCount,
    itemCount,
    errorCount,
    lastStatus: patch.ok ? 'ok' : 'error',
    lastError: patch.ok ? (cur?.lastError ?? null) : (patch.error ?? 'fetch failed'),
    successRate,
    updatedAt: new Date().toISOString(),
  };

  if (cur) {
    await ctx.db.update('source_health', { where: { sourceId }, set });
  } else {
    await ctx.db.insert('source_health', { sourceId, ...set });
  }
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const sources = (await ctx.db.query('sources', { where: { id: input.id } })) as Source[];
  const source = sources[0];
  if (!source) throw new HttpError(404, 'source not found');

  let inserted = 0;
  let skipped = 0;

  try {
    const res = await fetch(source.value, {
      headers: { 'User-Agent': 'lmthing.blog newsroom', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) {
      throw new Error(`feed responded ${res.status}`);
    }
    const xml = await res.text();
    const entries = parseFeed(xml);

    for (const e of entries) {
      try {
        await ctx.db.insert('raw_items', {
          sourceId: source.id,
          title: e.title,
          url: e.url,
          excerpt: e.excerpt || null,
          imageUrl: e.imageUrl || null,
        });
        inserted += 1;
      } catch {
        // unique(url) violation → already ingested
        skipped += 1;
      }
    }

    await recordHealth(ctx, source.id, { insertedCount: inserted, ok: true });
    return { inserted, skipped, status: 'ok' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await recordHealth(ctx, source.id, { insertedCount: inserted, ok: false, error });
    return { inserted, skipped, status: 'error', error };
  }
}
