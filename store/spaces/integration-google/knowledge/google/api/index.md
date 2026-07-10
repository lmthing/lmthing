---
variable: googleApi
description: The Google (Gmail + Calendar) REST surface reached via callConnection('google', ...) — base URL, the endpoints the wrapper functions use, their parameters, and the gateway-managed auth model.
---

# Google API (Gmail + Calendar) cheat-sheet

The agent talks to Google's REST APIs through `callConnection('google', req)`. The gateway pins the
base URL **`https://www.googleapis.com`** and attaches the user's OAuth access token — the agent
passes only a RELATIVE `path` and never handles credentials.

Two products are wrapped:

- **Gmail API** (`/gmail/v1/...`) — list/search messages, send mail.
- **Google Calendar API** (`/calendar/v3/...`) — list events on the primary calendar, create events.

Each wrapper function returns the response body (`callConnection(...).data`). Read that data and
answer from it; never fabricate messages, events, or counts. See the `endpoints` aspect for the
exact paths/params and the `auth` aspect for how scopes and tokens are handled (entirely by the
gateway).
