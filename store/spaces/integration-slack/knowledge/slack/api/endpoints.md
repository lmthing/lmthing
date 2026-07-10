# Methods used by the wrappers

Base URL (pinned by the gateway): `https://slack.com/api`. All paths below are the RELATIVE `path`
(a leading-slash method name) you pass to `callConnection('slack', { method, path, query?, body? })`.
Every response is a JSON envelope with a top-level `ok` boolean (+ `error` when `ok` is false).

### Post a message — `slackPostMessage(channel, text)`
- `POST /chat.postMessage`
- Body: `{ channel, text }`. `channel` is a channel id (e.g. `C0123ABCD`); `text` supports Slack
  mrkdwn. The bot/user must be a member of the channel (`not_in_channel` otherwise).
- Returns `{ ok, ts, channel, message }` on success, or `{ ok: false, error }`.

### List channels — `slackListChannels()`
- `GET /conversations.list`
- Query params (set by the wrapper): `types=public_channel,private_channel`, `limit=200`.
- Returns `{ ok, channels: [{ id, name, is_private, ... }], response_metadata: { next_cursor } }`.
- Use this to turn a human channel NAME into the `id` that `slackPostMessage` needs.

### Search messages — `slackSearchMessages(query)`
- `GET /search.messages`
- Query params: `query` (Slack search syntax: `from:@user`, `in:#channel`, `before:`, `after:`, or
  plain keywords).
- Returns `{ ok, query, messages: { total, matches: [...] } }`. Each match has `text`, `user`,
  `ts`, `channel`, `permalink`.
