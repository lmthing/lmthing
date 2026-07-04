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

export const name = 'followTopic';
export const description = 'Follow a topic by slug; upserts (updates if already present, otherwise creates it).';

export interface Input {
  slug: string;
  label?: string;
  weight?: number;
}

export interface Topic {
  id: string;
  slug: string;
  label: string;
  followed: boolean;
  muted: boolean;
  weight: number;
  articleCount: number;
  createdAt: string;
}

export type Output = Topic;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('topics')) as Topic[];
  const existing = rows.find((t) => t.slug === input.slug);

  if (existing) {
    const set: Record<string, unknown> = { followed: true, muted: false };
    if (input.label !== undefined) set.label = input.label;
    if (input.weight !== undefined) set.weight = input.weight;

    await ctx.db.update('topics', { where: { id: existing.id }, set });

    return { ...existing, ...set } as Topic;
  }

  const created = (await ctx.db.insert('topics', {
    slug: input.slug,
    label: input.label ?? input.slug,
    followed: true,
    muted: false,
    weight: input.weight ?? 1,
  })) as Topic;

  return created;
}
