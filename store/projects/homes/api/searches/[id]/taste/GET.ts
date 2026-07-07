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

export const name = 'tasteProfile';
export const description = "Get the learned taste model for a search — its cited notes and the most recent raw signals behind them.";

export interface Input {
  id: string;
}

export interface TasteNote {
  id: string;
  searchId: string;
  dimension: string;
  statement: string;
  weight: number;
  supportCount: number;
  createdAt: string;
}

export interface TasteSignal {
  id: string;
  searchId: string;
  listingId?: string;
  action: string;
  reason?: string;
  folded: boolean;
  createdAt: string;
}

interface Listing {
  id: string;
  title: string;
}

export interface Output {
  notes: TasteNote[];
  /** the most recent raw signals, each enriched with the acted-on listing's title */
  signals: (TasteSignal & { listingTitle?: string })[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const notes = (await ctx.db.query('taste_notes', { where: { searchId: input.id } })) as TasteNote[];
  notes.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  let recent = (await ctx.db.query('taste_signals', {
    where: { searchId: input.id },
  })) as TasteSignal[];
  recent.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  recent = recent.slice(0, 30);

  // Resolve each signal's listing title (equality-only where — one small query per distinct id).
  const listings = (await ctx.db.query('listings', { where: { searchId: input.id } })) as Listing[];
  const titleById = new Map(listings.map((l) => [l.id, l.title]));
  const signals = recent.map((s) => ({
    ...s,
    listingTitle: s.listingId ? titleById.get(s.listingId) : undefined,
  }));

  return { notes, signals };
}
