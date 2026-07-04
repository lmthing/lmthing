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

export const name = 'buildDigest';
export const description = 'Kick off building a new digest (daily or weekly); spawns the editorial curator to assemble it.';

export interface Input {
  period?: 'daily' | 'weekly';
}

export interface Output {
  digestId: string;
  status: 'building';
}

interface Digest {
  id: string;
  title: string;
  summary: string;
  period: string;
  status: string;
  articleCount: number;
  createdAt: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const digest = (await ctx.db.insert('digests', {
    title: 'Building digest…',
    summary: 'The editorial curator is assembling this digest.',
    period: input.period ?? 'daily',
    status: 'building',
  })) as Digest;

  await ctx.spawn(
    'editorial/curator#digest',
    { digestId: digest.id },
    {
      onError: () =>
        ctx.db.update('digests', { where: { id: digest.id }, set: { status: 'error' } }),
    },
  );

  return { digestId: digest.id, status: 'building' };
}
