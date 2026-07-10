# Auth (bring-your-own bot token)

lmthing does **not** broker Discord OAuth. You create your OWN Discord application + bot in the
[Discord Developer Portal](https://discord.com/developers/applications) and paste its secrets into
**the project's Settings → Integrations**, which stores them as pod environment variables:

- `DISCORD_BOT_TOKEN` — the bot's token (Bot page). Used to authenticate REST calls.
- `DISCORD_PUBLIC_KEY` — the application's public key (General Information). Used to verify inbound
  interaction signatures.
- `DISCORD_APPLICATION_ID` — the application id (General Information).

The agent never sees, stores, or refreshes these. On every `callConnection('discord', ...)` the pod:

1. Reads `DISCORD_BOT_TOKEN` from the pod env (per the space's `connection` descriptor).
2. Attaches it as an `Authorization: Bot <token>` header (auth kind `bot`).
3. Pins the host to `https://discord.com/api/v10` and forwards your relative `path` + `query`/`body`.
4. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response; Discord signals
   application errors with a body `{ message, code }` (e.g. a 403 with `code: 50001` "Missing Access").

The bot can only act where it has been **invited** and has the right **permissions/intents**. If the
token is missing, `callConnection` throws ("not configured — set DISCORD_BOT_TOKEN …") — ask the user
to add it in **Settings → Integrations** rather than authenticating yourself or fabricating a result.

## Inbound verification (pod-side)

Inbound Discord interactions are signed with Ed25519. The pod verifies each request from the space's
`webhook` descriptor using `DISCORD_PUBLIC_KEY` and the `x-signature-ed25519` /
`x-signature-timestamp` headers — no agent code involved. Discord's endpoint-validation **PING**
(`type: 1`) is answered automatically by the pod with a `{ type: 1 }` PONG. The user just points
Discord's **Interactions Endpoint URL** at their lmthing inbound URL (see the README).
