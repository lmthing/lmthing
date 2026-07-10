/**
 * Create a timed event on the user's primary Google Calendar
 * (POST /calendar/v3/calendars/primary/events).
 *
 * @param summary   Event title.
 * @param startISO  Start time as an RFC-3339 / ISO-8601 dateTime (e.g. "2026-07-10T15:00:00Z").
 * @param endISO    End time as an RFC-3339 / ISO-8601 dateTime.
 * @returns The created event resource: { id: string; htmlLink: string; status: string; start: any; end: any }
 */
export async function calendarCreateEvent(summary: string, startISO: string, endISO: string): Promise<any> {
  const r = await callConnection('google', {
    method: 'POST',
    path: '/calendar/v3/calendars/primary/events',
    body: {
      summary,
      start: { dateTime: startISO },
      end: { dateTime: endISO },
    },
  });
  return r.data;
}
