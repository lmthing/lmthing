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

export const name = 'getTakes';
export const description = 'List the cached LLM reframings (TL;DR / ELI5 / why-this-matters) for an article, most recent first.';

export interface Input {
  id: string;
}

export interface Take {
  id: string;
  articleId: string;
  kind: 'tldr' | 'eli5' | 'why-me';
  body: string;
  status: 'pending' | 'ready' | 'error';
  createdAt: string;
}

export type Output = Take[];

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('article_takes', {
    where: { articleId: input.id },
  })) as Take[];

  // `where` is equality-only, so sort newest-first in memory.
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
