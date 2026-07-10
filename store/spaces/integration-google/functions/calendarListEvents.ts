/**
 * List events on the user's primary Google Calendar
 * (GET /calendar/v3/calendars/primary/events).
 *
 * Events are expanded (`singleEvents`) and ordered by start time so the result is directly
 * readable. Pass ISO-8601 bounds to scope the window (e.g. "2026-07-09T00:00:00Z").
 *
 * @param timeMin  Optional lower bound (RFC-3339 / ISO-8601) — only events ending after this.
 * @param timeMax  Optional upper bound (RFC-3339 / ISO-8601) — only events starting before this.
 * @returns The events.list payload: { items: any[]; summary?: string; nextPageToken?: string }
 */
export async function calendarListEvents(timeMin?: string, timeMax?: string): Promise<any> {
  const q: Record<string, string> = { singleEvents: 'true', orderBy: 'startTime' };
  if (timeMin) q.timeMin = timeMin;
  if (timeMax) q.timeMax = timeMax;
  const r = await callConnection('google', {
    method: 'GET',
    path: '/calendar/v3/calendars/primary/events',
    query: q,
  });
  return r.data;
}
