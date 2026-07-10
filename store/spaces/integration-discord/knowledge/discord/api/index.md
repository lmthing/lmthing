---
variable: discordApi
description: The Discord REST v10 API surface reached via callConnection('discord', ...) — base URL, the endpoints the wrapper functions use, their parameters, the success/error shapes, the BYO bot-token auth model, and the inbound Interactions limitation.
---

# Discord REST v10 cheat-sheet

The agent talks to the Discord REST API through `callConnection('discord', req)`. The pod pins the
base URL **`https://discord.com/api/v10`** and attaches the user's own bot token as an
`Authorization: Bot <DISCORD_BOT_TOKEN>` header — the agent passes only a RELATIVE `path` (a
leading-slash route like `/channels/{id}/messages`) and never handles credentials.

## Wrapped endpoints (outbound — fully supported)

- **`POST /channels/{channelId}/messages`** — post a message (`discordCreateMessage`); with a
  `message_reference` it becomes a reply (`discordReplyMessage`).
- **`PATCH /channels/{channelId}/messages/{messageId}`** — edit the bot's own message
  (`discordEditMessage`).
- **`DELETE /channels/{channelId}/messages/{messageId}`** — delete a message (`discordDeleteMessage`).
- **`GET /guilds/{guildId}/channels`** — list a server's channels, incl. resolving a name → id
  (`discordListChannels`).
- **`PUT /channels/{channelId}/messages/{messageId}/reactions/{emoji}/@me`** — add the bot's reaction
  (`discordAddReaction`).
- **`POST /interactions/{interactionId}/{interactionToken}/callback`** — respond to a slash-command
  interaction (`discordRespondInteraction`).

## Success / error shape

Discord REST returns the **created or edited object** on success (a message object with `id`,
`channel_id`, `content`, `author`, `timestamp`, …), or an **empty body** for deletes and reactions
(HTTP 204). On failure it returns a JSON error `{ "message": "...", "code": <number> }` — e.g.
`{ "message": "Missing Access", "code": 50001 }`. Always check whether a `message`/`code` error came
back before reporting success. See the `endpoints` aspect for exact params and the `auth` aspect for
the BYO-token model.

## Inbound limitation (important)

Discord's inbound path is **Interactions over HTTP** (slash commands, buttons), delivered to the
`handler` agent and verified pod-side (ed25519). Two constraints shape what's possible:

- **3-second deadline** — the first response to an interaction must be sent within 3 seconds.
- **No Gateway websocket** — ordinary realtime channel messages (people typing) require a persistent
  Gateway websocket connection, which lmthing's scale-to-zero pods do not hold.

So inbound handles **slash-command interactions best-effort**, while the bot's **outbound** posting,
replying, editing, deleting, and reacting are fully supported. Frame this integration's primary value
as outbound bot control.
