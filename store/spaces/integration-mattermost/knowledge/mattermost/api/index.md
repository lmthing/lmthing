---
variable: mattermostApi
description: The Mattermost REST v4 API surface reached via callConnection('mattermost', ...) — base URL, the methods the wrapper functions use, their parameters, the success/error shapes, and the pod-managed BYO-token auth model.
---

# Mattermost REST v4 API cheat-sheet

The agent talks to the Mattermost REST v4 API through `callConnection('mattermost', req)`. The pod
pins the base URL to **`<MATTERMOST_BASE_URL>/api/v4`** (the user's own server) and attaches the
user's own `MATTERMOST_TOKEN` as a `Bearer` credential — the agent passes only a RELATIVE `path`
(a leading-slash resource like `/posts`) and never handles credentials.

Wrapped methods:

- **`POST /posts`** — create/post a message in a channel (`mattermostPostMessage`).
- **`GET /users/me`** — the authenticated bot/user account (`mattermostGetMe`).
- **`GET /users/me/teams`** — the teams the bot belongs to (`mattermostListTeams`).
- **`GET /users/me/teams/{teamId}/channels`** — the bot's channels in a team (`mattermostListChannels`).
- **`POST /reactions`** — add an emoji reaction to a post (`mattermostAddReaction`).
- **`GET /users/{userId}`** — look up a user by id (`mattermostGetUser`).

Mattermost returns the requested **object directly** on success (a post has `id` + `create_at`; a
list endpoint returns an array). On failure it returns an **error object**
`{ id, message, status_code }` (e.g. `status_code: 401` invalid token, `403` forbidden / not a
channel member, `404` not found). Always check for a `status_code`/`message` error shape before
reporting success. See the `endpoints` aspect for exact params and the `auth` aspect for the
BYO-token model.
