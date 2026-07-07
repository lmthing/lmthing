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

export const name = 'getListing';
export const description = 'Get a single listing with its scout analyses, location guesses, computed commutes and taste signals.';

export interface Input {
  id: string;
}

interface CostBreakdownItem {
  label: string;
  amount: number;
  basis: string;
  note?: string;
}

interface PhotoItem {
  url: string;
  caption?: string;
}

export interface ListingAnalysis {
  id: string;
  listingId: string;
  kind: string;
  body: string;
  flags?: string[];
  confidence: number;
  createdAt: string;
}

export interface LocationGuess {
  id: string;
  listingId: string;
  lat: number;
  lng: number;
  radiusM: number;
  confidence: number;
  method: string;
  createdAt: string;
}

export interface Commute {
  id: string;
  listingId: string;
  targetLabel: string;
  mode: string;
  minutes: number;
  basis: string;
  computedAt: string;
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

export interface Output {
  id: string;
  searchId: string;
  dedupeKey: string;
  title: string;
  url?: string;
  portal?: string;
  priceAmount: number;
  currency: string;
  trueCostMonthly: number;
  costBreakdown?: CostBreakdownItem[];
  address?: string;
  claimedLat?: number;
  claimedLng?: number;
  areaSqm: number;
  measuredAreaSqm: number;
  rooms: number;
  bedrooms: number;
  floor?: string;
  yearBuilt: number;
  description?: string;
  photoUrls?: PhotoItem[];
  flags?: string[];
  score: number;
  scoreSummary?: string;
  status: string;
  dismissedReason?: string;
  firstSeenAt: string;
  lastSeenAt?: string;
  analyses: ListingAnalysis[];
  guesses: LocationGuess[];
  commutes: Commute[];
  signals: TasteSignal[];
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('listings', {
    where: { id: input.id },
    include: ['analyses', 'guesses', 'commutes', 'signals'],
  })) as Output[];

  const listing = rows[0];
  if (!listing) {
    throw new HttpError(404, 'listing not found');
  }

  listing.analyses = (listing.analyses ?? []).sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );
  listing.guesses = (listing.guesses ?? []).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  listing.commutes = (listing.commutes ?? []).sort((a, b) =>
    (a.targetLabel ?? '').localeCompare(b.targetLabel ?? ''),
  );

  return listing;
}
