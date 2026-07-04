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

export const name = 'addAnnotation';
export const description = 'Add a highlight or note to an article passage; bumps the article\'s denormalized annotation count.';

export interface Input {
  id: string;
  quote: string;
  note?: string;
  kind?: string;
  color?: string;
}

export interface Annotation {
  id: string;
  articleId: string;
  quote: string;
  note: string;
  kind: string;
  color: string;
  verified: boolean;
  createdAt: string;
}

interface Article {
  id: string;
  annotationCount: number;
}

export type Output = Annotation;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const created = (await ctx.db.insert('annotations', {
    articleId: input.id,
    quote: input.quote,
    note: input.note,
    kind: input.kind ?? 'note',
    color: input.color ?? 'accent',
  })) as Annotation;

  const articleRows = (await ctx.db.query('articles', { where: { id: input.id } })) as Article[];
  const article = articleRows[0];
  if (article) {
    await ctx.db.update('articles', {
      where: { id: article.id },
      set: { annotationCount: (article.annotationCount ?? 0) + 1 },
    });
  }

  return created;
}
