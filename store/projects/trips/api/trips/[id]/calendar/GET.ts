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

export const name = 'tripCalendar';
export const description =
  'Build an RFC-5545 iCalendar (.ics) feed of the trip — itinerary items (with day/time), bookings and transit legs — so the itinerary can be imported into any calendar app. Returns the .ics text plus a suggested filename.';

export interface Input {
  id: string;
}

export interface Output {
  ics: string;
  filename: string;
  eventCount: number;
}

interface Trip {
  id: string;
  title: string;
}
interface Dest {
  id: string;
  name: string;
}
interface Item {
  id: string;
  destinationId: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  kind: string;
  location?: string;
  notes?: string;
}
interface Booking {
  id: string;
  kind: string;
  provider?: string;
  confirmation?: string;
  startAt?: string;
  endAt?: string;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** '2026-10-12' + '08:10' → '20261012T081000' (floating local time). */
function dt(day: string, time?: string): string {
  const [y, m, d] = day.split('-');
  if (!time) return `${y}${m}${d}`;
  const [hh, mm] = time.split(':');
  return `${y}${m}${d}T${pad(Number(hh))}${pad(Number(mm))}00`;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + 1));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const trips = (await ctx.db.query('trips', { where: { id: input.id } })) as Trip[];
  const trip = trips[0];
  const title = trip?.title ?? 'Trip';

  const dests = (await ctx.db.query('destinations', { where: { tripId: input.id } })) as Dest[];
  const destName = new Map(dests.map((d) => [d.id, d.name]));
  const bookings = (await ctx.db.query('bookings', { where: { tripId: input.id } })) as Booking[];

  const items: Item[] = [];
  for (const d of dests) {
    const rows = (await ctx.db.query('itinerary_items', { where: { destinationId: d.id } })) as Item[];
    items.push(...rows);
  }

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lmthing.trips//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(title)}`,
  ];

  let eventCount = 0;
  const pushEvent = (uid: string, summary: string, start: string, end: string | null, allDay: boolean, location?: string, desc?: string) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}@lmthing.trips`);
    lines.push(`DTSTAMP:${stamp}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      if (end) lines.push(`DTEND;VALUE=DATE:${end}`);
    } else {
      lines.push(`DTSTART:${start}`);
      if (end) lines.push(`DTEND:${end}`);
    }
    lines.push(`SUMMARY:${esc(summary)}`);
    if (location) lines.push(`LOCATION:${esc(location)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push('END:VEVENT');
    eventCount++;
  };

  for (const it of items) {
    if (!it.day) continue;
    const place = destName.get(it.destinationId);
    const loc = it.location || place;
    if (it.startTime) {
      const start = dt(it.day, it.startTime);
      const end = it.endTime ? dt(it.day, it.endTime) : null;
      pushEvent(it.id, `${it.title}`, start, end, false, loc, it.notes);
    } else {
      pushEvent(it.id, `${it.title}`, dt(it.day), nextDay(it.day), true, loc, it.notes);
    }
  }

  for (const b of bookings) {
    if (!b.startAt) continue;
    const day = b.startAt.slice(0, 10);
    const summary = `${b.kind}${b.provider ? ` · ${b.provider}` : ''}`;
    const desc = b.confirmation ? `Confirmation: ${b.confirmation}` : undefined;
    pushEvent(`bk-${b.id}`, summary, dt(day), nextDay(day), true, undefined, desc);
  }

  lines.push('END:VCALENDAR');

  return {
    ics: lines.join('\r\n'),
    filename: `${title.replace(/[^\w-]+/g, '-').toLowerCase() || 'trip'}.ics`,
    eventCount,
  };
}
