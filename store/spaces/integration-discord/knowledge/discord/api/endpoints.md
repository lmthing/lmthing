# Endpoints used by the wrappers

Base URL (pinned by the pod): `https://discord.com/api/v10`. All paths below are the RELATIVE `path`
you pass to `callConnection('discord', { method, path, query?, body? })`. Ids are numeric snowflakes
(e.g. `1012345678901234567`). On success Discord returns the affected object (or an empty 204 body for
deletes/reactions); on failure it returns `{ message, code }`.

### Post a message — `discordCreateMessage(channelId, content)`
- `POST /channels/{channelId}/messages`
- Body: `{ content }`. `content` supports Discord markdown, max 2000 chars.
- Returns the created message object `{ id, channel_id, content, author, timestamp, ... }`.
- Needs `Send Messages` permission in the channel; `Missing Access` (50001) if the bot isn't there.

### Reply to a message — `discordReplyMessage(channelId, content, messageId)`
- `POST /channels/{channelId}/messages`
- Body: `{ content, message_reference: { message_id: messageId } }`.
- Returns the created (reply) message object. The reply visibly references the original.

### Edit a message — `discordEditMessage(channelId, messageId, content)`
- `PATCH /channels/{channelId}/messages/{messageId}`
- Body: `{ content }`. A bot can only edit **its own** messages.
- Returns the updated message object.

### Delete a message — `discordDeleteMessage(channelId, messageId)`
- `DELETE /channels/{channelId}/messages/{messageId}`
- No body. Deleting another author's message needs `MANAGE_MESSAGES`.
- Returns an empty body (HTTP 204) on success.

### List channels — `discordListChannels(guildId)`
- `GET /guilds/{guildId}/channels`
- Returns an array of channel objects `[{ id, name, type, position, parent_id, ... }]`. Channel
  `type` 0 = text, 2 = voice, 4 = category, 5 = announcement, etc. Use this to resolve a human channel
  NAME to the `id` the message functions need.

### Add a reaction — `discordAddReaction(channelId, messageId, emoji)`
- `PUT /channels/{channelId}/messages/{messageId}/reactions/{emoji}/@me`
- `emoji` is URL-encoded by the wrapper: pass a Unicode emoji (`👍`) or `name:id` for a custom guild
  emoji. `@me` adds the reaction as the bot.
- Returns an empty body (HTTP 204) on success. Needs `Add Reactions` (+ `Read Message History`).

### Respond to an interaction — `discordRespondInteraction(interactionId, interactionToken, content)`
- `POST /interactions/{interactionId}/{interactionToken}/callback`
- Body: `{ type: 4, data: { content } }` — type 4 = CHANNEL_MESSAGE_WITH_SOURCE (visible reply).
- `interactionId` and `interactionToken` come from the inbound interaction payload (`id`, `token`).
- Must be sent within **3 seconds** of the interaction. Returns an empty body (204) on success;
  `Interaction has already been acknowledged` (40060) or an expired token if you were too slow.

## Common error codes

`10003` Unknown Channel · `10008` Unknown Message · `40060` Interaction already acknowledged ·
`50001` Missing Access · `50013` Missing Permissions · `50035` Invalid Form Body · `401` bad/expired
bot token.
