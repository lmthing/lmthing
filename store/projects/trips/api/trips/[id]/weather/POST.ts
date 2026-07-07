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

export const name = 'refreshWeather';
export const description =
  'Geocode each destination (Nominatim, cached to destinations.lat/lng) and fetch a per-day forecast from Open-Meteo (free, keyless), writing itinerary_items.weatherNote for scheduled days that fall within the forecast horizon. Degrades gracefully when a destination cannot be located or dates are beyond the ~16-day horizon.';

export interface Input {
  id: string;
}

export interface DestinationForecast {
  destinationId: string;
  name: string;
  located: boolean;
  days: { date: string; note: string }[];
}

export interface Output {
  destinations: DestinationForecast[];
  itemsUpdated: number;
  note?: string;
}

interface Dest {
  id: string;
  tripId: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

// Open-Meteo WMO weather codes → short human label.
function codeLabel(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly cloudy';
  if (code === 3) return 'overcast';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow showers';
  return 'thunderstorm';
}

async function geocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'lmthing.trips/1.0 (trip planner)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = rows[0];
    if (!hit?.lat || !hit?.lon) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon) };
  } catch {
    return null;
  }
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const dests = (await ctx.db.query('destinations', { where: { tripId: input.id } })) as Dest[];
  const out: DestinationForecast[] = [];
  let itemsUpdated = 0;
  let horizonSkipped = false;

  for (const dest of dests) {
    let lat = typeof dest.lat === 'number' ? dest.lat : null;
    let lng = typeof dest.lng === 'number' ? dest.lng : null;

    if (lat == null || lng == null) {
      const geo = await geocode(dest.name);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        await ctx.db.update('destinations', { where: { id: dest.id }, set: { lat, lng } });
      }
    }

    if (lat == null || lng == null) {
      out.push({ destinationId: dest.id, name: dest.name, located: false, days: [] });
      continue;
    }

    // Only the days that actually have scheduled items are worth annotating.
    const items = (await ctx.db.query('itinerary_items', { where: { destinationId: dest.id } })) as Array<{ id: string; day?: string }>;
    const days = [...new Set(items.map((i) => i.day).filter(Boolean) as string[])].sort();
    const dayNotes: { date: string; note: string }[] = [];

    try {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone: 'auto',
      });
      if (days.length) {
        params.set('start_date', days[0]!);
        params.set('end_date', days[days.length - 1]!);
      }
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          daily?: {
            time?: string[];
            weathercode?: number[];
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            precipitation_probability_max?: number[];
          };
        };
        const d = body.daily;
        const times = d?.time ?? [];
        for (let i = 0; i < times.length; i++) {
          const date = times[i]!;
          const label = codeLabel(Number(d?.weathercode?.[i] ?? 3));
          const hi = Math.round(Number(d?.temperature_2m_max?.[i]));
          const lo = Math.round(Number(d?.temperature_2m_min?.[i]));
          const pop = Number(d?.precipitation_probability_max?.[i]);
          const parts = [label];
          if (Number.isFinite(hi) && Number.isFinite(lo)) parts.push(`${lo}–${hi}°C`);
          if (Number.isFinite(pop) && pop >= 30) parts.push(`${pop}% rain`);
          const note = parts.join(', ');
          dayNotes.push({ date, note });
          if (days.includes(date)) {
            const n = await ctx.db.update('itinerary_items', {
              where: { destinationId: dest.id, day: date },
              set: { weatherNote: note },
            });
            itemsUpdated += n;
          }
        }
      } else if (days.length) {
        horizonSkipped = true;
      }
    } catch {
      // leave this destination without notes
    }

    out.push({ destinationId: dest.id, name: dest.name, located: true, days: dayNotes });
  }

  return {
    destinations: out,
    itemsUpdated,
    note: horizonSkipped
      ? 'Some dates are beyond the ~16-day forecast horizon; those days were skipped.'
      : undefined,
  };
}
