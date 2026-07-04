/**
 * Roll up confirmed booking costs and estimated itinerary costs into a single budget summary,
 * grouped by kind (flight/hotel/car/activity for bookings; activity/meal/transit/lodging for
 * items). Pure summation — no I/O, no randomness.
 */
export function rollUpBudget(
  bookings: { kind?: string; cost?: number }[],
  items: { kind?: string; estimatedCost?: number }[],
): { booked: number; estimated: number; byKind: { kind: string; booked: number; estimated: number }[] } {
  const byKind = new Map<string, { booked: number; estimated: number }>();

  const bump = (kind: string, field: 'booked' | 'estimated', amount: number) => {
    const entry = byKind.get(kind) ?? { booked: 0, estimated: 0 };
    entry[field] += amount;
    byKind.set(kind, entry);
  };

  let booked = 0;
  for (const b of bookings) {
    const kind = b.kind ?? 'other';
    const cost = typeof b.cost === 'number' ? b.cost : 0;
    booked += cost;
    bump(kind, 'booked', cost);
  }

  let estimated = 0;
  for (const it of items) {
    const kind = it.kind ?? 'other';
    const cost = typeof it.estimatedCost === 'number' ? it.estimatedCost : 0;
    estimated += cost;
    bump(kind, 'estimated', cost);
  }

  return {
    booked,
    estimated,
    byKind: Array.from(byKind.entries()).map(([kind, v]) => ({ kind, booked: v.booked, estimated: v.estimated })),
  };
}
