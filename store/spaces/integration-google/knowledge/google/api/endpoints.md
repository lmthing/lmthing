# Endpoints used by the wrappers

Base URL (pinned by the gateway): `https://www.googleapis.com`. All paths below are the RELATIVE
`path` you pass to `callConnection('google', { method, path, query?, body? })`.

## Gmail

### List / search messages — `gmailListMessages(query?, maxResults?)`
- `GET /gmail/v1/users/me/messages`
- Query params: `q` (Gmail search syntax, e.g. `is:unread`, `from:x@y.com`, `newer_than:7d`,
  `subject:invoice`), `maxResults` (default 25 in the wrapper).
- Returns `{ messages?: [{ id, threadId }], resultSizeEstimate, nextPageToken? }`. This gives you
  IDs only — a follow-up `GET /gmail/v1/users/me/messages/{id}` would fetch a single message's
  headers/body (not wrapped; add if needed).

### Send mail — `gmailSend(to, subject, body)`
- `POST /gmail/v1/users/me/messages/send`
- Body: `{ raw }` where `raw` is the **base64url-encoded** RFC-2822 message (headers + blank line +
  body). The wrapper builds the MIME message and encodes it for you.
- Returns the sent message resource `{ id, threadId, labelIds? }`.

## Calendar

### List events — `calendarListEvents(timeMin?, timeMax?)`
- `GET /calendar/v3/calendars/primary/events`
- Query params: `singleEvents=true` and `orderBy=startTime` (always set by the wrapper), plus
  optional `timeMin` / `timeMax` as RFC-3339 / ISO-8601 timestamps.
- Returns `{ items: [...events], summary?, nextPageToken? }`. Each event has `summary`, `start`,
  `end`, `htmlLink`, `attendees?`, etc.

### Create event — `calendarCreateEvent(summary, startISO, endISO)`
- `POST /calendar/v3/calendars/primary/events`
- Body: `{ summary, start: { dateTime }, end: { dateTime } }` (ISO-8601 dateTimes).
- Returns the created event `{ id, htmlLink, status, start, end }`.
