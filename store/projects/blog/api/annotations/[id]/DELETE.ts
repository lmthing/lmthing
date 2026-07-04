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

export const name = 'removeAnnotation';
export const description = 'Delete an annotation, decrementing its article\'s denormalized annotation count.';

export interface Input {
  id: string;
}

export interface Output {
  ok: boolean;
}

interface Annotation {
  id: string;
  articleId: string;
}

interface Article {
  id: string;
  annotationCount: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('annotations', { where: { id: input.id } })) as Annotation[];
  const annotation = rows[0];

  if (!annotation) {
    return { ok: true };
  }

  await ctx.db.remove('annotations', { where: { id: input.id } });

  const articleRows = (await ctx.db.query('articles', { where: { id: annotation.articleId } })) as Article[];
  const article = articleRows[0];
  if (article) {
    await ctx.db.update('articles', {
      where: { id: article.id },
      set: { annotationCount: Math.max(0, (article.annotationCount ?? 0) - 1) },
    });
  }

  return { ok: true };
}
