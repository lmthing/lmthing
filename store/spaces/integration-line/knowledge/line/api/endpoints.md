# Methods used by the wrappers

Base URL (pinned by the pod): `https://api.line.me`. All paths below are the RELATIVE `path` you
pass to `callConnection('line', { method, path, query?, body? })`. Every message-send response is an
**empty JSON object `{}`** on success (HTTP 200), or `{ message, details }` on failure. There is no
`ok` flag — treat "has a `message` field" as the error signal.

Message objects are always an array: `messages: [{ type: 'text', text }]`. The wrappers send a
single text message; LINE allows up to 5 message objects per request and a 5000-char text limit.

### Reply — `lineReply(replyToken, text)`
- `POST /v2/bot/message/reply`
- Body: `{ replyToken, messages: [{ type: 'text', text }] }`.
- `replyToken` comes from an inbound webhook `event.replyToken`. It is **single-use** and expires in
  ~1 minute. On a stale/used token the response is `{ message: "Invalid reply token" }`.
- Returns `{}` on success.

### Push — `linePush(to, text)`
- `POST /v2/bot/message/push`
- Body: `{ to, messages: [{ type: 'text', text }] }`. `to` is a `userId`, `groupId`, or `roomId`.
- Counts against the account's monthly push-message quota. Returns `{}` on success.

### Multicast — `lineMulticast(to, text)`
- `POST /v2/bot/message/multicast`
- Body: `{ to, messages: [{ type: 'text', text }] }` where `to` is an ARRAY of `userId`s (individual
  users only — not groups or rooms). Up to 500 ids per call. Returns `{}` on success.

### Broadcast — `lineBroadcast(text)`
- `POST /v2/bot/message/broadcast`
- Body: `{ messages: [{ type: 'text', text }] }` — no recipient list; goes to every friend of the
  account. Returns `{}` on success. Uses push quota heavily; use sparingly.

### Get profile — `lineGetProfile(userId)`
- `GET /v2/bot/profile/{userId}`
- Path includes the target `userId` (the wrapper URL-encodes it). Works only for users who have
  added the account as a friend.
- Returns `{ userId, displayName, pictureUrl?, statusMessage?, language? }` on success, or
  `{ message, details }` on error.
