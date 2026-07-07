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
export const description =
  'Resolve a place name to latitude/longitude via OpenStreetMap Nominatim (free, keyless). Returns null coordinates when nothing matches or the service is unavailable.';

export interface Input {
  q: string;
}

export interface Output {
  q: string;
  lat: number | null;
  lng: number | null;
  displayName: string | null;
}

export default async function handler(input: Input, _ctx: Ctx): Promise<Output> {
  const q = (input.q ?? '').trim();
  if (!q) return { q, lat: null, lng: null, displayName: null };
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'lmthing.trips/1.0 (trip planner)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const hit = rows[0];
    if (!hit?.lat || !hit?.lon) return { q, lat: null, lng: null, displayName: null };
    return {
      q,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      displayName: hit.display_name ?? null,
    };
  } catch {
    return { q, lat: null, lng: null, displayName: null };
  }
}
