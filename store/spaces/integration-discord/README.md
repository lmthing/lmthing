# Connect Discord

This integration lets THING **control your Discord bot** — post messages, reply, edit, delete, and add
reactions in your server — and **answer slash commands** that people run in Discord. To connect it you
create a free Discord application (your own bot) in the Discord Developer Portal and copy three values
into the fields on this page.

It takes about 10 minutes. Follow every step.

> **What works, and a limit to know up front.** THING's **outbound** control of your bot (posting,
> replying, editing, deleting, reacting) is fully supported and reliable — that's the main value.
> **Inbound** is limited: Discord only delivers **slash commands** to a webhook, and it demands a reply
> within **3 seconds**. Ordinary chat messages people type in channels need a always-on "Gateway"
> connection that THING's cost-saving sleep-when-idle pods don't keep open. So treat inbound as
> **best-effort slash-command answers**, and think of this integration primarily as **THING driving your
> bot outward**.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Bot token** (`INTEGRATION_DISCORD_BOT_TOKEN`) | Lets THING act as your bot on Discord | `MTI3ND5...` (long) |
| **Public key** (`INTEGRATION_DISCORD_PUBLIC_KEY`) | Lets us verify that interactions Discord sends are genuine | a 64-character hex string |
| **Application ID** (`INTEGRATION_DISCORD_APPLICATION_ID`) | Your app's numeric id | `1012345678901234567` |

---

## Step-by-step

### 1. Create an application
1. Open **[discord.com/developers/applications](https://discord.com/developers/applications)** and sign in.
2. Click **New Application** (top right).
3. Give it a name (e.g. *THING*), tick the boxes to accept Discord's terms, and click **Create**.
4. You land on the **General Information** page.

### 2. Copy the Public Key and Application ID
1. Still on **General Information**, find **Application ID** → click **Copy**. Paste it into the
   **Application ID** field on this page.
2. Just below, find **Public Key** → click **Copy**. Paste it into the **Public key** field on this page.

### 3. Add a bot and copy the Bot token
1. In the left sidebar click **Bot**.
2. If prompted, click **Add Bot** / **Reset Token** to reveal the token, then click **Copy** to copy the
   **Bot Token**. (Discord only shows it once — if you lose it, click **Reset Token** to make a new one.)
3. Paste it into the **Bot token** field on this page.
4. While on this page, scroll to **Privileged Gateway Intents**. For posting/reacting you don't need any
   of these, so you can leave them off.

### 4. Invite the bot to your server
1. In the left sidebar open **OAuth2** → **URL Generator**.
2. Under **Scopes**, tick **bot** and **applications.commands**.
3. Under **Bot Permissions**, tick at least: **Send Messages**, **Read Message History**,
   **Add Reactions** (and **Manage Messages** if you want THING to delete others' messages).
4. Copy the **Generated URL** at the bottom, open it in your browser, pick your server, and click
   **Authorize**. The bot now appears in your server's member list.

### 5. Save
Click **Save & Restart Pod** at the bottom of this page. Wait ~30 seconds for the pod to restart, then
ask THING to *"post a hello message to my Discord channel."* (Give THING the channel — you can copy a
channel id in Discord by enabling Developer Mode, then right-clicking the channel → **Copy Channel ID**.)

---

## Optional: answering slash commands (inbound)

If you also want THING to **answer slash commands** people run in your server:

1. On this page, copy the **inbound URL** shown in **Settings → Integrations** — it looks like
   `https://lmthing.cloud/api/inbound/<your-token>/discord` (it must end in `/discord`).
2. Back in the Discord Developer Portal, open your app's **General Information** page.
3. Find **Interactions Endpoint URL**, paste that inbound URL, and click **Save Changes**.
4. Discord immediately sends a **PING** to validate the URL. Your pod answers it automatically using the
   **Public Key** you already entered. If it saves without an error, you're verified.
5. Register a slash command for your app (via Discord's API or a tool of your choice), then run it in your
   server. Remember the **3-second** reply limit — quick answers land in-channel; slower ones may miss the
   window.

---

## For automations — the `message.received` event

Once connected (bot token + public key + application id saved, and the **Interactions Endpoint URL**
registered above), every inbound Discord message this space accepts emits an event you can hook from any
project:

**`integration-discord/message.received`**

| Payload field | Type | Value |
|---|---|---|
| `text` | `string` | The message content the user sent (`content`). |
| `from` | `string` | The author's Discord user id (`author.id`). |
| `chatId` | `string` | The channel to reply in (`channel_id`). |
| `userName` | `string?` | The author's `username` (absent if none). |
| `threadKey` | `string?` | The originating `channel_id` (a stable per-channel thread). |
| `raw` | `object` | The full raw Discord payload JSON. |

Discord's endpoint-validation **PING** and messages from **bots** are ignored — only real, non-bot
messages with text are emitted. (The PING is answered automatically by the pod using your **Public
key**, before any agent wakes.)

### Automate "when a Discord message arrives, do X"

Ask THING something like *"when a discord message arrives, reply with a summary"* and the automator
writes a project event hook subscribed to this event. The hook reads `ctx.input` and replies in the same
channel via the space's `discordCreateMessage` function (which wraps `callConnection('discord', …)`):

```ts
// hooks/discord-reply.ts — on:{ event: 'integration-discord/message.received' }
export default async function (ctx) {
  const input = ctx.input; // { text, from, chatId, userName, threadKey, raw }
  const answer = `You said: ${input.text}`;
  // reply in the same channel
  await discordCreateMessage(input.chatId, answer);
}
```

Keys (bot token + public key + application id) and a registered **Interactions Endpoint URL** are still
required for events to flow — follow the steps above first.

---

## What goes where

| This page (Settings → Integrations) | Copy it from the Discord Developer Portal |
|---|---|
| **Bot token** (`INTEGRATION_DISCORD_BOT_TOKEN`) | Your app → **Bot** → **Reset Token** / **Copy** |
| **Public key** (`INTEGRATION_DISCORD_PUBLIC_KEY`) | Your app → **General Information** → **Public Key** |
| **Application ID** (`INTEGRATION_DISCORD_APPLICATION_ID`) | Your app → **General Information** → **Application ID** |
| **Interactions Endpoint URL** (on Discord's side) | The inbound URL shown here, ending in `/discord` |

---

## Troubleshooting

- **Interactions Endpoint URL won't validate ("failed to verify")** — the **Public key** is wrong or
  mistyped. Recopy it from **General Information** and re-enter it here, save the pod, then try saving the
  endpoint URL in Discord again. Also confirm the URL ends in `/discord`.
- **`401 Unauthorized` / bot calls fail** — the **Bot token** is wrong or was reset. Click **Reset Token**
  on the Bot page, copy the new one, and paste it here.
- **`Missing Access` (code 50001)** — the bot isn't in that server or channel. Re-invite it (step 4) and
  make sure it can see the channel.
- **`Missing Permissions` (code 50013)** — the bot lacks a permission (e.g. Add Reactions, Manage
  Messages). Re-invite with the permission ticked, or adjust its role in **Server Settings → Roles**.
- **Slash command replies arrive late or not at all** — Discord's 3-second deadline was missed, or the
  request needs the always-on Gateway connection this integration doesn't hold. This is expected; use
  THING's outbound posting for reliable messaging.
- Tokens are stored as private environment variables on your pod and never leave it.
