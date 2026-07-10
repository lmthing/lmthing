---
variable: slackApi
description: The Slack Web API surface reached via callConnection('slack', ...) — base URL, the methods the wrapper functions use, their parameters, the ok/error envelope, and the gateway-managed auth model.
---

# Slack Web API cheat-sheet

The agent talks to the Slack Web API through `callConnection('slack', req)`. The gateway pins the
base URL **`https://slack.com/api`** and attaches the user's OAuth token — the agent passes only a
RELATIVE `path` (a leading-slash method name like `/chat.postMessage`) and never handles
credentials.

Wrapped methods:

- **`/chat.postMessage`** — post a message to a channel (`slackPostMessage`).
- **`/conversations.list`** — list channels, incl. resolving a name → id (`slackListChannels`).
- **`/search.messages`** — search messages across the workspace (`slackSearchMessages`).

Every Slack Web API call returns a JSON envelope with a top-level `ok` boolean; on failure `ok` is
`false` and an `error` string names the reason (e.g. `channel_not_found`, `not_in_channel`,
`invalid_auth`). Always check `ok` before reporting success. See the `endpoints` aspect for exact
params and the `auth` aspect for the gateway-managed token model.
