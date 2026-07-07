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

export const name = 'geocode';
export const description = 'Forward-geocode an address or place with OpenStreetMap Nominatim (keyless), server-side and throttled — resolves a commute target or a location clue to coordinates. Returns null-ish when nothing matches; the client never calls Nominatim directly.';

export interface Input {
  /** Address, place, street, or amenity to resolve, e.g. "Praça do Comércio, Lisbon". */
  q: string;
  /** Optional ISO country hint to disambiguate, e.g. "pt". */
  country?: string;
}

export interface Output {
  found: boolean;
  lat?: number;
  lng?: number;
  displayName?: string;
  /** true when the upstream service was unreachable (vs. a genuine no-match). */
  degraded?: boolean;
}

// Nominatim asks for ≤1 req/s and an identifying User-Agent. We keep a tiny
// in-process gate so bursts (a form with several commute targets) stay polite.
let lastCallAt = 0;
async function polite(): Promise<void> {
  const wait = 1100 - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  void ctx;
  const q = (input.q ?? '').trim();
  if (!q) return { found: false };

  await polite();

  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '1', addressdetails: '0' });
  if (input.country) params.set('countrycodes', input.country);
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'lmthing.homes/1.0 (project-app; contact via lmthing.store)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return { found: false, degraded: true };
    const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
    const hit = Array.isArray(data) ? data[0] : undefined;
    if (!hit || hit.lat === undefined || hit.lon === undefined) return { found: false };
    return {
      found: true,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      displayName: hit.display_name,
    };
  } catch {
    // Graceful degradation — geocoding is an enhancement, never a hard dependency.
    return { found: false, degraded: true };
  }
}
