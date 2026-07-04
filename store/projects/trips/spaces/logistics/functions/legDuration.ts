/**
 * Estimate a transit leg's total door-to-door duration in minutes from its mode and the
 * point-to-point distance, using per-mode overhead + cruise-speed heuristics. This is a fallback
 * for when a `webSearch` hasn't turned up a route-specific duration — real schedules should
 * always be preferred over this estimate when available.
 */
export function legDuration(
  mode: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'walk',
  distanceKm: number,
): number {
  const km = Math.max(0, distanceKm);

  switch (mode) {
    case 'flight': {
      // Fixed overhead for security/boarding/deplaning/luggage, plus a rough cruise speed
      // that ignores the short taxi/climb/descent segments at each end.
      const overheadMinutes = 150; // ~2.5h airport overhead, short-haul assumption
      const cruiseSpeedKmh = 750;
      return Math.round(overheadMinutes + (km / cruiseSpeedKmh) * 60);
    }
    case 'train': {
      // Boarding overhead is much smaller than a flight's; average speed accounts for stops.
      const overheadMinutes = 20;
      const avgSpeedKmh = 120;
      return Math.round(overheadMinutes + (km / avgSpeedKmh) * 60);
    }
    case 'bus': {
      const overheadMinutes = 20;
      const avgSpeedKmh = 65;
      return Math.round(overheadMinutes + (km / avgSpeedKmh) * 60);
    }
    case 'car': {
      // No boarding overhead, but pickup/parking/traffic friction is folded into a slightly
      // lower average speed than pure highway cruise.
      const overheadMinutes = 10;
      const avgSpeedKmh = 80;
      return Math.round(overheadMinutes + (km / avgSpeedKmh) * 60);
    }
    case 'ferry': {
      // Ferries are slow and have real terminal check-in overhead.
      const overheadMinutes = 45;
      const avgSpeedKmh = 35;
      return Math.round(overheadMinutes + (km / avgSpeedKmh) * 60);
    }
    case 'walk': {
      // Capped — walking is only realistic for very short hops within a destination.
      const avgSpeedKmh = 4.5;
      const minutes = (km / avgSpeedKmh) * 60;
      return Math.round(Math.min(minutes, 180));
    }
    default: {
      const _exhaustive: never = mode;
      return 0;
    }
  }
}
