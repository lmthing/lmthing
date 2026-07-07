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

export const name = 'addSource';
export const description = 'Add a new capture source to a home search — an alert email, saved search, pasted link, or manual entry.';

export interface Input {
  id: string;
  kind: string;
  label: string;
  url?: string;
  notes?: string;
}

export interface Source {
  id: string;
  searchId: string;
  kind: string;
  label: string;
  url?: string;
  pollEnabled: boolean;
  pollIntervalHours: number;
  lastPolledAt?: string;
  blockedReason?: string;
  notes?: string;
  lastIngestedAt?: string;
  createdAt: string;
}

export type Output = Source;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const source = (await ctx.db.insert('sources', {
    searchId: input.id,
    kind: input.kind,
    label: input.label,
    url: input.url,
    notes: input.notes,
  })) as Output;

  return source;
}
