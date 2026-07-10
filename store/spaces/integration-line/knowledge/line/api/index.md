---
variable: lineApi
description: The LINE Messaging API surface reached via callConnection('line', ...) — base URL, the methods the wrapper functions use, their parameters, the empty-object/error response shape, and the BYO-token auth model.
---

# LINE Messaging API cheat-sheet

The agent talks to the LINE Messaging API through `callConnection('line', req)`. The pod pins the
base URL **`https://api.line.me`** and attaches the user's own **channel access token** as
`Authorization: Bearer …` — the agent passes only a RELATIVE `path` (e.g. `/v2/bot/message/push`)
and never handles credentials.

Wrapped methods:

- **`/v2/bot/message/reply`** — reply to an inbound event using its one-time reply token (`lineReply`).
- **`/v2/bot/message/push`** — send to one user/group/room by id (`linePush`).
- **`/v2/bot/message/multicast`** — send to an array of individual `userId`s (`lineMulticast`).
- **`/v2/bot/message/broadcast`** — send to every friend of the account (`lineBroadcast`).
- **`/v2/bot/profile/{userId}`** — fetch a user's display profile (`lineGetProfile`).

**Response shape is unusual.** A successful send returns an **empty JSON object `{}`** with HTTP 200
— there is no `ok`/`id`/`ts` field to inspect. A failure returns `{ message, details }`, where
`message` is a human-readable reason (e.g. `Invalid reply token`, `Authorization failed`) and
`details` is an array pinpointing the invalid property. So the success test is "no `message` field",
not "some truthy flag". `lineGetProfile` is the exception — on success it returns a populated
`{ userId, displayName, … }` object. See the `endpoints` aspect for exact params and the `auth`
aspect for the BYO-token model.
