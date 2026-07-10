# Methods used by the wrappers

Base URL (pinned by the pod): `<INTEGRATION_MATTERMOST_BASE_URL>/api/v4`. All paths below are the RELATIVE
`path` (a leading-slash resource) you pass to
`callConnection('mattermost', { method, path, query?, body? })`. On success each returns the
requested object/array; on failure it returns `{ id, message, status_code }`.

### Post a message — `mattermostPostMessage(channelId, message, rootId?)`
- `POST /posts`
- Body: `{ channel_id, message, root_id? }`. `channel_id` is a channel id (26-char slug like
  `4xp9fdt77pncbef59f4k1qe83o`); `message` supports Mattermost markdown. Pass `root_id` (the id of
  the post being replied to) to thread the reply. The bot must be a member of the channel (`403`
  otherwise).
- Returns the created post `{ id, channel_id, user_id, message, root_id, create_at, ... }`, or an
  error object.

### Who am I — `mattermostGetMe()`
- `GET /users/me`
- Returns the authenticated user `{ id, username, email, first_name, last_name, roles, ... }`. Use
  its `id` when a call needs the bot's own user id (e.g. adding a reaction).

### List teams — `mattermostListTeams()`
- `GET /users/me/teams`
- Returns an array `[{ id, name, display_name, type, ... }]`. A server is organised into teams;
  channels live inside a team. Use a team `id` with `mattermostListChannels`.

### List channels — `mattermostListChannels(teamId)`
- `GET /users/me/teams/{teamId}/channels`
- Returns an array `[{ id, name, display_name, type, team_id, ... }]` — the channels in that team
  the bot belongs to. `name` is the URL slug; `display_name` is the human name. Use this to turn a
  channel name into the `id` that `mattermostPostMessage` needs.

### Add reaction — `mattermostAddReaction(userId, postId, emojiName)`
- `POST /reactions`
- Body: `{ user_id, post_id, emoji_name }`. `user_id` should be the bot's own id (from
  `mattermostGetMe`); `emoji_name` is WITHOUT colons (e.g. `thumbsup`, `eyes`).
- Returns `{ user_id, post_id, emoji_name, create_at }`, or an error object.

### Get user — `mattermostGetUser(userId)`
- `GET /users/{userId}`
- Returns `{ id, username, email, first_name, last_name, nickname, ... }`. Use it to resolve a
  `user_id` (e.g. from an inbound event) to a human username.

## Inbound outgoing-webhook payload (for the handler)

Mattermost outgoing webhooks POST a **form-encoded** body with: `token`, `channel_id`,
`channel_name`, `user_id`, `user_name`, `post_id`, `text`, `trigger_word`. The handler replies with
`mattermostPostMessage(channel_id, answer, post_id)` — passing `post_id` as the root keeps the reply
threaded. Outgoing webhooks fire **only on trigger words in public channels** (not DMs/private
channels).
