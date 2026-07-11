# Connect Nextcloud Talk

This integration lets THING **send messages into your Nextcloud Talk (Spreed) conversations** and
**reply to messages people send there**. It works through a small **Talk bot** that a Nextcloud admin
installs from the server command line.

Because Nextcloud only allows Talk bots to be created from the server shell (for security), this setup
needs **admin access to your Nextcloud server** (the `occ` command) and the **Talk** app installed.
If you're not the server admin, ask whoever runs your Nextcloud to do the two `occ` commands below —
you supply them the secret and the inbound URL from this page.

It takes about 5 minutes. Follow every step.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Nextcloud URL** (`INTEGRATION_NEXTCLOUD_TALK_BASE_URL`) | The web address of your Nextcloud site | `https://cloud.example.com` |
| **Bot secret** (`INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET`) | A long random secret you invent; it lets your server and THING trust each other | a 40+ character random string |

You'll also need, from **this page**, the **inbound URL** (see step 3) — it looks like
`https://lmthing.cloud/api/inbound/<your-token>/nextcloud`.

---

## Step-by-step

### 1. Make sure Talk is installed
Sign in to Nextcloud as an administrator and confirm the **Talk** (Spreed) app is enabled under
**Apps → Multimedia → Talk**. You need Talk **17.1 or newer** (Nextcloud 27.1+) for bots.

### 2. Invent a bot secret
Make up a long random string (at least 40 characters — mix letters and numbers). This is your
**Bot secret**.

- Paste it into the **Bot secret** field on this page now, so you don't lose it.
- You'll also give the exact same value to the `occ` command in step 4.

### 3. Copy your lmthing inbound URL
On this **Settings → Integrations** page, find the **inbound URL** for this integration. It ends in
`/nextcloud` and looks like:

```
https://lmthing.cloud/api/inbound/<your-token>/nextcloud
```

Copy it — this is the **webhook URL** your bot will send incoming messages to.

### 4. Install the bot on your Nextcloud server
Open a shell on the Nextcloud server and run `occ talk:bot:install`, passing a name, your **Bot
secret** (step 2), and your **inbound URL** (step 3):

```bash
occ talk:bot:install "THING" "<YOUR_BOT_SECRET>" "https://lmthing.cloud/api/inbound/<your-token>/nextcloud"
```

- Use the SAME secret you put in the **Bot secret** field.
- The command prints the new bot's **id** (a number) — note it for the next step.
- On a Docker/AIO install the command is usually
  `docker exec -it -u www-data nextcloud-aio-nextcloud php occ talk:bot:install …`.

### 5. Enable the bot in a conversation
A bot only works in conversations where it's been switched on. For each Talk conversation you want
THING to use, run (using the bot **id** from step 4 and the conversation's **room token**):

```bash
occ talk:bot:setup <botId> <roomToken>
```

The **room token** is the code in the conversation's URL: `.../call/<roomToken>`.

### 6. Fill in your Nextcloud URL
Put your site's address (e.g. `https://cloud.example.com`) into the **Nextcloud URL** field on this
page. No trailing slash.

### 7. Save
Click **Save & Restart Pod** at the bottom. Wait ~30 seconds for the pod to restart, then send a
message in an enabled Talk conversation — THING will reply in-thread. You can also ask THING to
*"send a hello into Talk room `<roomToken>`."*

---

## What goes where

| This page (Settings → Integrations) | Where it comes from |
|---|---|
| **Nextcloud URL** (`INTEGRATION_NEXTCLOUD_TALK_BASE_URL`) | Your Nextcloud site address, e.g. `https://cloud.example.com`. |
| **Bot secret** (`INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET`) | The long random string you invented in step 2 — the SAME value you passed to `occ talk:bot:install`. |
| Inbound URL (shown on this page, ends in `/nextcloud`) | You give this to `occ talk:bot:install` as the bot's webhook URL (step 4). It is not a field you fill in. |

The **same bot secret** signs both directions: THING signs the messages it sends, and Nextcloud signs
the events it delivers to your inbound URL — so the secret must match exactly on both sides.

---

## Troubleshooting

- **`401` / signature errors when sending** — the **Bot secret** on this page doesn't match the one you
  gave `occ talk:bot:install`. Re-enter the exact same secret (or reinstall the bot with the secret
  from this page).
- **`404` when sending to a conversation** — the bot isn't enabled in that room. Run
  `occ talk:bot:setup <botId> <roomToken>` for it (step 5).
- **THING never sees incoming messages** — the bot's webhook URL is wrong or wasn't set. Check
  `occ talk:bot:list` shows your bot with the inbound URL ending in `/nextcloud`, and that the bot is
  set up in the conversation (step 5).
- **`command not found: occ`** — run it as the web-server user from the Nextcloud directory
  (`sudo -u www-data php occ …`), or via `docker exec` on containerized installs.
- **Nothing happens after saving** — give the pod ~30 seconds to restart, and confirm the **Nextcloud
  URL** has no trailing slash and is reachable from the internet.
- Your secret and URL are stored as private environment variables on your pod and never leave it.

---

## For automations — the `message.received` event

Once connected (Nextcloud URL + bot secret saved, the bot installed with `occ talk:bot:install`, and
enabled in a conversation with `occ talk:bot:setup`), every inbound Nextcloud Talk chat message this
space emits an event you can hook from any project:

**`integration-nextcloud-talk/message.received`**

| Payload field | Type | Value |
|---|---|---|
| `text` | `string` | The message text (parsed from `object.content`'s `.message`, falling back to the raw content). |
| `from` | `string` | The sender's display name (`actor.name`). |
| `chatId` | `string` | The conversation **room token** to reply in (`target.id`). |
| `userName` | `string?` | The sender's display name (`actor.name`). |
| `threadKey` | `string?` | `nextcloud:<room token>` — a stable per-conversation continuity key. |
| `raw` | `object` | The full raw Nextcloud Talk bot event JSON. |

Only real, incoming chat messages are emitted — non-`Create` events (reactions, joins/leaves, system
messages), non-`Note` objects, and the bot's own messages (actor type `Application`) are ignored.

### Automate "when a Nextcloud Talk message arrives, do X"

Ask THING something like *"when a Nextcloud Talk message arrives, reply with a summary"* and the
automator writes a project event hook subscribed to this event. The hook reads `ctx.input` and replies
into the same conversation via `callConnection('nextcloud-talk', …)` (posting the reply to the
conversation identified by `input.chatId`):

```ts
// hooks/nextcloud-reply.ts — on:{ event: 'integration-nextcloud-talk/message.received' }
export default async function (ctx) {
  const input = ctx.input; // { text, from, chatId, userName, threadKey, raw }
  const answer = `You said: ${input.text}`;
  // reply into the same conversation (room token = input.chatId)
  await callConnection('nextcloud-talk', {
    method: 'POST',
    path: `/bot/${encodeURIComponent(input.chatId)}/message`,
    headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
    body: { message: answer },
  });
}
```

Keys (bot secret + Nextcloud base URL) and an installed, conversation-enabled bot are still required
for events to flow — follow steps 1–7 above first.
