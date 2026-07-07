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

export const name = 'exportOpml';
export const description = 'Export every RSS source as a standard OPML 2.0 document for import into another reader.';

export interface Input {}

export interface Output {
  opml: string;
  count: number;
}

interface Source {
  id: string;
  kind: string;
  value: string;
  label: string;
}

function xmlEscape(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const sources = (await ctx.db.query('sources', { where: { kind: 'rss' } })) as Source[];

  const outlines = sources
    .map((s) => {
      const label = xmlEscape(s.label || s.value);
      const url = xmlEscape(s.value);
      return `    <outline type="rss" text="${label}" title="${label}" xmlUrl="${url}"/>`;
    })
    .join('\n');

  const opml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<opml version="2.0">\n` +
    `  <head><title>lmthing.blog sources</title></head>\n` +
    `  <body>\n` +
    (outlines ? outlines + '\n' : '') +
    `  </body>\n` +
    `</opml>`;

  return { opml, count: sources.length };
}
