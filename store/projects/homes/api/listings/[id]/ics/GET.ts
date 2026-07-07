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

export const name = 'listingIcs';
export const description = 'Build a calendar event (RFC-5545 .ics text + a Google Calendar add-event URL) for viewing a listing — title, address/best-guess area, price, url, and the score reasoning in the notes. No OAuth needed; closes the loop to the real-world action.';

export interface Input {
  id: string;
  /** ISO datetime for the viewing; defaults to tomorrow 18:00 if omitted. */
  startAt?: string;
  /** Duration in minutes (default 30). */
  durationMin?: number;
}

export interface Output {
  filename: string;
  ics: string;
  googleUrl: string;
}

interface Listing {
  id: string;
  searchId: string;
  title: string;
  url?: string;
  address?: string;
  priceAmount: number;
  currency: string;
  trueCostMonthly: number;
  scoreSummary?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
/** Date → UTC "YYYYMMDDTHHMMSSZ" (basic-format, floating-to-UTC). */
function icsStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
function icsEscape(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('listings', { where: { id: input.id } })) as Listing[];
  const listing = rows[0];
  if (!listing) throw new HttpError(404, 'listing not found');

  const start = input.startAt ? new Date(input.startAt) : (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  })();
  const durationMin = input.durationMin && input.durationMin > 0 ? input.durationMin : 30;
  const end = new Date(start.getTime() + durationMin * 60_000);

  const money = `${listing.currency || ''} ${Math.round(listing.priceAmount || 0)}`.trim();
  const summary = `View: ${listing.title}`;
  const location = listing.address || '';
  const descParts = [
    money ? `Asking: ${money}` : '',
    listing.trueCostMonthly > 0 ? `All-in: ${Math.round(listing.trueCostMonthly)}/mo` : '',
    listing.url ? `Listing: ${listing.url}` : '',
    listing.scoreSummary ? `\nWhy this scored well:\n${listing.scoreSummary}` : '',
  ].filter(Boolean);
  const description = descParts.join('\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lmthing.homes//viewing//EN',
    'BEGIN:VEVENT',
    `UID:homes-${listing.id}-${start.getTime()}@lmthing.homes`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    location ? `LOCATION:${icsEscape(location)}` : '',
    `DESCRIPTION:${icsEscape(description)}`,
    listing.url ? `URL:${icsEscape(listing.url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const g = new URLSearchParams({
    action: 'TEMPLATE',
    text: summary,
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
    details: description,
    location,
  });
  const googleUrl = `https://calendar.google.com/calendar/render?${g.toString()}`;

  const filename = `viewing-${listing.title.replace(/[^\w]+/g, '-').slice(0, 40).toLowerCase()}.ics`;
  return { filename, ics, googleUrl };
}
