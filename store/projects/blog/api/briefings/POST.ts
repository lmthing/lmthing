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

export const name = 'requestBriefing';
export const description = 'Request a research briefing on a topic, optionally scoped to a collection; the generate-briefing hook drives the analyst on insert.';

export interface Input {
  topic: string;
  collectionId?: string;
}

export interface Output {
  briefingId: string;
  status: 'pending';
}

interface Briefing {
  id: string;
  title: string;
  topic: string;
  status: string;
  sourceCount: number;
  collectionId?: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const briefing = (await ctx.db.insert('briefings', {
    title: input.topic,
    topic: input.topic,
    status: 'pending',
    sourceCount: 0,
    collectionId: input.collectionId,
  })) as Briefing;

  return { briefingId: briefing.id, status: 'pending' };
}
