export default {
  type: 'cron',
  every: '24h',
  // Declarative daily scan: the navigator's `booking-windows` action self-scans every trip's
  // itinerary items for things that must be booked ahead (needsBooking && !bookingId with an
  // approaching bookByDate) and writes cited knowledge_notes reminders. (Cron hooks support
  // `trigger` only — imperative handlers are for `database` hooks.)
  trigger: 'logistics/navigator#booking-windows',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
};
