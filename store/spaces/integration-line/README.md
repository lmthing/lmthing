# Connect LINE

This integration lets THING **send messages from your LINE Official Account** and **reply to
messages people send it on LINE**. To connect it you create a free LINE Messaging API channel in
your own LINE Developers account and copy two secrets into the fields on this page.

It takes about 10 minutes. Follow every step.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Channel access token** (`INTEGRATION_LINE_CHANNEL_ACCESS_TOKEN`) | Lets THING send messages as your LINE account | a long string, often 150+ characters |
| **Channel secret** (`INTEGRATION_LINE_CHANNEL_SECRET`) | Lets us verify that inbound messages really came from LINE | a 32-character hex string |

---

## Step-by-step

### 1. Sign in to the LINE Developers Console
1. Open **[developers.line.biz/console](https://developers.line.biz/console/)** and log in with your
   LINE account (or a LINE Business ID). The first time, you'll be asked to accept the developer
   agreement and enter your name + email.

### 2. Create a Provider
1. On the console home, click **Create a new provider**.
2. Give it a name (e.g. your company or your own name) and click **Create**. A "provider" is just
   the owner that your channels live under.

### 3. Create a Messaging API channel
1. Inside your provider, click **Create a Messaging API channel** (older accounts: **Create a new
   channel → Messaging API**).
2. Fill in the required fields — channel name (this is the name people see, e.g. *THING*), channel
   description, category, and region.
3. Agree to the terms and click **Create**. This also creates a matching **LINE Official Account**.

### 4. Copy the Channel secret
1. Open your new channel and click the **Basic settings** tab.
2. Find **Channel secret** and copy the value.
3. Paste it into the **Channel secret** field on this page.

### 5. Issue and copy the Channel access token
1. Click the **Messaging API** tab.
2. Scroll to **Channel access token (long-lived)** (some accounts label it **Channel access token**)
   and click **Issue**.
3. Copy the token that appears.
4. Paste it into the **Channel access token** field on this page.

### 6. Turn off auto-reply and greeting messages
So THING's replies aren't overridden by LINE's canned responses:
1. Still on the **Messaging API** tab, find **Auto-reply messages** and click **Edit** — this opens
   the **LINE Official Account Manager**.
2. Set **Auto-reply messages** to **Disabled** and **Greeting messages** to **Disabled** (optional
   but recommended).

### 7. Save
Click **Save & Restart Pod** at the bottom of this page. Wait ~30 seconds for the pod to restart,
then ask THING to *"send a LINE broadcast saying hello"* (or push to your own userId).

---

## Receiving LINE messages (recommended)

To let THING **reply when people message your account**, point LINE's webhook at your lmthing inbox:

1. This project's **Settings → Integrations** shows your inbound URL. It looks like:
   `https://lmthing.cloud/api/inbound/<your-token>/line`  — copy it.
2. Back in the LINE Developers Console, open your channel → **Messaging API** tab → **Webhook URL** →
   click **Edit**, paste the URL, and click **Update**.
3. Turn **Use webhook** **on**.
4. Click **Verify** — LINE sends a test request; a green success means the signature (your channel
   secret) checks out. A **401** here means the **Channel secret** you pasted in step 4 is wrong.
5. Add your LINE account as a friend (scan the QR code on the **Messaging API** tab) and send it a
   message — THING will reply.

---

## What goes where

| This page's field | Where to copy it from in the LINE Developers Console |
|---|---|
| **Channel access token** | Your channel → **Messaging API** tab → **Channel access token (long-lived)** → **Issue** |
| **Channel secret** | Your channel → **Basic settings** tab → **Channel secret** |
| *(webhook URL — you paste OUT, not in)* | From **Settings → Integrations** here → into the channel's **Messaging API** tab → **Webhook URL** |

---

## Troubleshooting

- **`Invalid reply token`** — reply tokens are single-use and expire ~1 minute after the message
  arrives. THING replies immediately; if a token has already expired it falls back to a push
  message. Nothing to fix on your side.
- **`Authorization failed`** — the **Channel access token** is wrong or was re-issued; recopy it
  from the **Messaging API** tab (step 5) and save again.
- **Webhook "Verify" returns 401** — the **Channel secret** is wrong. Recopy it from the **Basic
  settings** tab (step 4).
- **THING never replies to LINE messages** — check that **Use webhook** is on, the webhook URL ends
  in `/line`, and **Auto-reply messages** is **Disabled** (step 6).
- **The account replies with a canned message instead of THING** — auto-reply is still on; disable
  it in the LINE Official Account Manager (step 6).
- Tokens are stored as private environment variables on your pod and never leave it.

---

## For automations — the `message.received` event

Once connected (channel access token + channel secret saved, and the webhook URL registered under
**Receiving LINE messages** above), every inbound LINE **text** message this space emits an event you
can hook from any project:

**`integration-line/message.received`**

| Payload field | Type | Value |
|---|---|---|
| `text` | `string` | The message text the user sent. |
| `from` | `string` | The sender's LINE `userId` (empty string if LINE omits it). |
| `chatId` | `string` | Where to reply — the `groupId`, else `roomId`, else `userId` of the source. |
| `userName` | `string?` | Reserved (LINE's webhook carries no display name; use `lineGetProfile` if needed). |
| `threadKey` | `string?` | Not set — LINE has no threading model. |
| `raw` | `object` | `{ event, replyToken }` — the raw LINE event plus its **single-use reply token**. |

A single LINE webhook delivery can carry several events, so this space emits **one event per text
message**. Only real, incoming **text** messages are emitted — follow / unfollow / join / leave /
postback events and non-text messages (stickers, images, …) are ignored.

**`raw.replyToken` is how you reply.** It is single-use and expires ~1 minute after the message
arrives, so reply immediately; if it has expired, fall back to `linePush(chatId, …)`.

### Automate "when a LINE message arrives, do X"

Ask THING something like *"when a LINE message arrives, reply with a summary"* and the automator
writes a project event hook subscribed to this event. The hook reads `ctx.input` and replies via the
space's functions (which wrap `callConnection('line', …)`):

```ts
// hooks/line-reply.ts — on:{ event: 'integration-line/message.received' }
export default async function (ctx) {
  const input = ctx.input; // { text, from, chatId, raw: { event, replyToken } }
  const answer = `You said: ${input.text}`;
  // reply using the single-use reply token; fall back to a push if it has expired
  const res = await lineReply(input.raw.replyToken, answer);
  if (res && res.message) await linePush(input.chatId, answer);
}
```

Keys (channel access token + channel secret) and a registered webhook URL are still required for
events to flow — follow the steps above first.
