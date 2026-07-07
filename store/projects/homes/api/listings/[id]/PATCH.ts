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

export const name = 'updateListing';
export const description = 'Update fields on a listing. A manual status change also logs a taste signal so the ranker learns from it.';

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

export interface Input {
  id: string;
  status?: string;
  title?: string;
  url?: string;
  portal?: string;
  priceAmount?: number;
  currency?: string;
  trueCostMonthly?: number;
  costBreakdown?: CostBreakdownItem[];
  address?: string;
  claimedLat?: number;
  claimedLng?: number;
  areaSqm?: number;
  measuredAreaSqm?: number;
  rooms?: number;
  bedrooms?: number;
  floor?: string;
  yearBuilt?: number;
  description?: string;
  photoUrls?: PhotoItem[];
  flags?: string[];
  score?: number;
  scoreSummary?: string;
  dismissedReason?: string;
}

export interface Listing {
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
}

export type Output = Listing;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const existingRows = (await ctx.db.query('listings', { where: { id: input.id } })) as Listing[];
  const existing = existingRows[0];
  if (!existing) {
    throw new HttpError(404, 'listing not found');
  }

  const set: Record<string, unknown> = {};
  if (input.status !== undefined) set.status = input.status;
  if (input.title !== undefined) set.title = input.title;
  if (input.url !== undefined) set.url = input.url;
  if (input.portal !== undefined) set.portal = input.portal;
  if (input.priceAmount !== undefined) set.priceAmount = input.priceAmount;
  if (input.currency !== undefined) set.currency = input.currency;
  if (input.trueCostMonthly !== undefined) set.trueCostMonthly = input.trueCostMonthly;
  if (input.costBreakdown !== undefined) set.costBreakdown = input.costBreakdown;
  if (input.address !== undefined) set.address = input.address;
  if (input.claimedLat !== undefined) set.claimedLat = input.claimedLat;
  if (input.claimedLng !== undefined) set.claimedLng = input.claimedLng;
  if (input.areaSqm !== undefined) set.areaSqm = input.areaSqm;
  if (input.measuredAreaSqm !== undefined) set.measuredAreaSqm = input.measuredAreaSqm;
  if (input.rooms !== undefined) set.rooms = input.rooms;
  if (input.bedrooms !== undefined) set.bedrooms = input.bedrooms;
  if (input.floor !== undefined) set.floor = input.floor;
  if (input.yearBuilt !== undefined) set.yearBuilt = input.yearBuilt;
  if (input.description !== undefined) set.description = input.description;
  if (input.photoUrls !== undefined) set.photoUrls = input.photoUrls;
  if (input.flags !== undefined) set.flags = input.flags;
  if (input.score !== undefined) set.score = input.score;
  if (input.scoreSummary !== undefined) set.scoreSummary = input.scoreSummary;
  if (input.dismissedReason !== undefined) set.dismissedReason = input.dismissedReason;

  await ctx.db.update('listings', { where: { id: input.id }, set });

  if (input.status !== undefined) {
    await ctx.db.insert('taste_signals', {
      searchId: existing.searchId,
      listingId: input.id,
      action: 'note',
      reason: `status → ${input.status}`,
    });
  }

  const rows = (await ctx.db.query('listings', { where: { id: input.id } })) as Listing[];
  const listing = rows[0];
  if (!listing) {
    throw new HttpError(404, 'listing not found');
  }

  return listing;
}
