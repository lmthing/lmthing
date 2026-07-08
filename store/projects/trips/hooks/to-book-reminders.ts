// Imperative, no-LLM cron handler — was a declarative trigger delegating to
// logistics/navigator#booking-windows (an agent session that self-scanned every
// trip). This is pure date math with no
// judgment call an LLM adds value on, so it now self-scans in plain code: itinerary
// items that `needsBooking` and have no `bookingId`, plus `suggested` transit legs,
// whose `bookByDate` falls within the next WINDOW_DAYS (the same 14-day "soon"
// threshold `tripReminders` already uses, api/trips/[id]/reminders/GET.ts) — and
// writes one `knowledge_notes` reminder each, same shape the navigator wrote. Each
// note's body carries a hidden `ref:item:<id>` / `ref:leg:<id>` marker so a later run
// never writes a duplicate reminder for the same item/leg. The navigator's
// `booking-windows` action (spaces/logistics/agents/navigator/instruct.md) is left
// intact for ad-hoc chat use; this hook no longer calls it.
type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown> }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}

const MS_PER_DAY = 86400000;
const WINDOW_DAYS = 14;

function deadlineText(daysLeft: number): string {
  return daysLeft < 0 ? `overdue by ${Math.abs(daysLeft)} day(s)` : `due in ${daysLeft} day(s)`;
}

export default {
  type: 'cron',
  every: '24h',
  budget: { maxWallClockMs: 60000 },
  handler: async ({ db }: { db: Db }) => {
    try {
      const now = Date.now();
      const windowEnd = now + WINDOW_DAYS * MS_PER_DAY;

      const trips = await db.query('trips');
      const destinations = await db.query('destinations');
      const items = await db.query('itinerary_items');
      const legs = await db.query('transit_legs');
      // Only need this table to check for an existing ref — scope to logistics notes.
      const existingNotes = await db.query('knowledge_notes', { where: { sourceKind: 'logistics' } });

      const tripsById = new Map(trips.map((t) => [t.id as string, t]));
      const destTripId = new Map(destinations.map((d) => [d.id as string, d.tripId as string]));
      const hasRef = (ref: string) =>
        existingNotes.some((n) => typeof n.body === 'string' && (n.body as string).includes(ref));

      const toWrite: Row[] = [];

      // 1. Itinerary items that need booking, aren't booked yet, and fall inside the
      //    booking window (bookByDate within WINDOW_DAYS — including already overdue).
      for (const item of items) {
        if (!item.needsBooking || item.bookingId) continue;
        const bookByDate = item.bookByDate as string | undefined;
        if (!bookByDate) continue;
        const due = new Date(bookByDate).getTime();
        if (Number.isNaN(due) || due > windowEnd) continue;

        const tripId = destTripId.get(item.destinationId as string);
        if (!tripId) continue;
        const trip = tripsById.get(tripId);
        if (!trip || trip.status === 'complete') continue; // active/upcoming trips only

        const ref = `ref:item:${item.id}`;
        if (hasRef(ref)) continue; // already reminded for this exact item

        const daysLeft = Math.floor((due - now) / MS_PER_DAY);
        toWrite.push({
          tripId,
          destinationId: item.destinationId,
          topic: `book ${item.title}`,
          body:
            `**${item.title}** still needs to be booked, by ${bookByDate} (${deadlineText(daysLeft)}).\n\n` +
            `_${ref}_`,
          sourceKind: 'logistics',
        });
      }

      // 2. Suggested transit legs with an approaching bookByDate.
      for (const leg of legs) {
        if (leg.status !== 'suggested') continue;
        const bookByDate = leg.bookByDate as string | undefined;
        if (!bookByDate) continue;
        const due = new Date(bookByDate).getTime();
        if (Number.isNaN(due) || due > windowEnd) continue;

        const tripId = leg.tripId as string | undefined;
        if (!tripId) continue;
        const trip = tripsById.get(tripId);
        if (!trip || trip.status === 'complete') continue;

        const ref = `ref:leg:${leg.id}`;
        if (hasRef(ref)) continue; // already reminded for this exact leg

        const daysLeft = Math.floor((due - now) / MS_PER_DAY);
        const label = `${(leg.mode as string) ?? 'transit'} leg`;
        toWrite.push({
          tripId,
          topic: `book ${label}`,
          body:
            `The ${label} to destination ${leg.toDestinationId} should be booked by ${bookByDate} ` +
            `(${deadlineText(daysLeft)}) to lock in a reasonable fare.\n\n_${ref}_`,
          sourceKind: 'logistics',
        });
      }

      if (toWrite.length === 0) return;
      await db.insert('knowledge_notes', toWrite);
    } catch (err) {
      console.error('[to-book-reminders] unexpected failure:', err);
    }
  },
};
