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

export const name = 'routeTime';
export const description = 'Real door-to-door minutes between two coordinates via OpenRouteService (walk/bike/drive; OSM-based, free key). Gracefully unavailable when ORS_API_KEY is not set in the pod env — callers then keep the surveyor heuristic. Public-transit routing is a Later gated item (needs a billed provider).';

export interface Input {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** 'walk' | 'bike' | 'drive'. 'transit' is not supported by ORS → returns unavailable. */
  mode: string;
}

export interface Output {
  /** false when no key is configured or the service failed — caller falls back to the heuristic. */
  available: boolean;
  minutes?: number;
  /** cited assumptions, mirrors commutes.basis discipline. */
  basis?: string;
  reason?: string;
}

const ORS_PROFILE: Record<string, string> = {
  walk: 'foot-walking',
  bike: 'cycling-regular',
  drive: 'driving-car',
};

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  void ctx;
  const key = process.env.ORS_API_KEY;
  const profile = ORS_PROFILE[input.mode];

  if (!profile) {
    return { available: false, reason: `mode '${input.mode}' not routable via ORS (transit needs a billed provider)` };
  }
  if (!key) {
    // Feature-flagged off — the app keeps working on the surveyor's heuristic.
    return { available: false, reason: 'ORS_API_KEY not configured' };
  }

  try {
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [
          [input.from.lng, input.from.lat],
          [input.to.lng, input.to.lat],
        ],
      }),
    });
    if (!res.ok) return { available: false, reason: `ORS ${res.status}` };
    const data = (await res.json()) as { routes?: { summary?: { duration?: number } }[] };
    const seconds = data.routes?.[0]?.summary?.duration;
    if (typeof seconds !== 'number') return { available: false, reason: 'no route' };
    const minutes = Math.round(seconds / 60);
    return {
      available: true,
      minutes,
      basis: `routed via OpenRouteService (${profile.replace('-', ' ')}), OSM network`,
    };
  } catch {
    return { available: false, reason: 'ORS request failed' };
  }
}
