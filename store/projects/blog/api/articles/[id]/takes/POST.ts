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

export const name = 'requestTake';
export const description = 'Request a cached LLM reframing (TL;DR / ELI5 / why-this-matters) of an article; returns a cached take when one exists, otherwise seeds a pending row (the generate-take hook drives the explainer on insert).';

const KINDS = ['tldr', 'eli5', 'why-me'] as const;
type Kind = (typeof KINDS)[number];

export interface Input {
  id: string;
  kind: Kind;
}

export interface Take {
  id: string;
  articleId: string;
  kind: Kind;
  body: string;
  status: 'pending' | 'ready' | 'error';
  createdAt: string;
}

export type Output = Take;

interface Article {
  id: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!KINDS.includes(input.kind)) {
    throw new HttpError(400, `Unknown take kind '${input.kind}' — expected one of ${KINDS.join(', ')}`);
  }

  const articles = (await ctx.db.query('articles', { where: { id: input.id } })) as Article[];
  if (articles.length === 0) {
    throw new HttpError(404, `Article ${input.id} not found`);
  }

  // Idempotent cache: reuse a ready take, or a pending one already in flight.
  // `where` is equality-only, so filter the article's takes for this kind in memory.
  const existing = (await ctx.db.query('article_takes', { where: { articleId: input.id } })) as Take[];
  const forKind = existing.filter((t) => t.articleId === input.id && t.kind === input.kind);
  const ready = forKind.find((t) => t.status === 'ready');
  if (ready) return ready;
  const pending = forKind.find((t) => t.status === 'pending');
  if (pending) return pending;

  // Seed the pending row. Inserting it fires the `generate-take` database hook, which runs the
  // explainer to fill `body` + mark it `ready`. We drive the LLM through the insert-hook (rather than
  // a direct `ctx.spawn`) on purpose: the pending row is the idempotence cache — a concurrent request
  // for the same take reuses it instead of spawning a second run. The client polls `GET .../takes`
  // until this row flips to `ready`.
  const row = (await ctx.db.insert('article_takes', {
    articleId: input.id,
    kind: input.kind,
    status: 'pending',
    body: '',
  })) as Take;

  return row;
}
