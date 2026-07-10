# Connect Mattermost

This integration lets THING **post messages to your Mattermost** and **reply to Mattermost messages**.
To connect it you point THING at your Mattermost server, give it a bot token, and (for receiving
messages) create one outgoing webhook. You then copy three values into the fields on this page.

It takes about 10 minutes. Follow every step. You need to be a **System Admin** on your Mattermost
server (or ask your admin to do the admin steps).

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Server URL** (`MATTERMOST_BASE_URL`) | The web address of your Mattermost server | `https://mattermost.example.com` |
| **Bot / access token** (`MATTERMOST_TOKEN`) | Lets THING act as a bot on your server | a 26-character string |
| **Outgoing webhook token** (`MATTERMOST_OUTGOING_TOKEN`) | Lets us verify messages Mattermost sends back are genuine | a 26-character string |

> Enter the **Server URL** exactly as you open Mattermost in your browser (starts with `https://`),
> with **no** trailing slash and **no** `/api/v4` — we add that for you.

---

## Step-by-step

### 1. Get your Server URL
Open Mattermost in your browser and copy the address, e.g. `https://mattermost.example.com`. Paste
it into the **Server URL** field on this page.

### 2. Turn on integrations (admin, one-time)
1. Click your **team name / product menu** → **System Console**.
2. Go to **Integrations → Integration Management**.
3. Set **Enable Bot Account Creation** to **true**.
4. Set **Enable Outgoing Webhooks** to **true**.
5. (Recommended) Set **Enable integrations to override usernames** to **true** so THING's replies
   show a friendly name.
6. Click **Save**.

### 3. Create a bot account & copy its token
1. Leave the System Console (click the product menu → your team).
2. Open the **product menu (☰ / grid icon at top-left)** → **Integrations** → **Bot Accounts**.
3. Click **Add Bot Account**.
4. Give it a **Username** (e.g. `thing`), an optional display name, and click **Create Bot Account**.
5. Mattermost shows a **token** once — copy it now. Paste it into the **Bot / access token** field
   on this page.
   - *Prefer a personal access token instead?* In **System Console → Integrations → Integration
     Management** set **Enable Personal Access Tokens** to **true**, then create one from your
     **Profile → Security → Personal Access Tokens**. Either token works here.

### 4. Add the bot to a channel
A bot can only post in channels it belongs to. Open the channel you want THING to use and, from the
channel menu, choose **Add Members** and add your bot (e.g. `@thing`). Do this for each channel you
want THING to post in.

### 5. Create an Outgoing Webhook (to receive messages)
1. Open the **product menu → Integrations → Outgoing Webhooks**.
2. Click **Add Outgoing Webhook**.
3. Fill it in:
   - **Title / Description**: anything, e.g. *THING*.
   - **Content Type**: `application/x-www-form-urlencoded` (the default) is fine.
   - **Channel**: pick the **public** channel THING should listen in (outgoing webhooks only work in
     public channels — see the note below).
   - **Trigger Words**: the word(s) that should summon THING, e.g. `thing`. A message must **start
     with** a trigger word to fire the webhook. (If you leave this blank, every message in the
     chosen channel fires it.)
   - **Callback URLs**: paste the **inbound URL** shown in this project's **Settings → Integrations**
     for Mattermost. It looks like:
     ```
     https://lmthing.cloud/api/inbound/<your-token>/mattermost
     ```
4. Click **Save**. Mattermost shows a **Token** for this webhook — copy it and paste it into the
   **Outgoing webhook token** field on this page.

### 6. Save
Click **Save & Restart Pod** at the bottom of this page. Wait ~30 seconds for the pod to restart,
then in your chosen channel type `thing hello` (using your trigger word). THING should reply in a
thread. You can also just ask THING here to *"post a hello to the #general channel in Mattermost."*

---

## What goes where

| This page's field | Where to copy it from on Mattermost |
|---|---|
| **Server URL** (`MATTERMOST_BASE_URL`) | Your browser's address bar when viewing Mattermost (e.g. `https://mattermost.example.com`). |
| **Bot / access token** (`MATTERMOST_TOKEN`) | Product menu → **Integrations → Bot Accounts** → your bot's generated **token** (shown once at creation). Or a **Personal Access Token** from **Profile → Security**. |
| **Outgoing webhook token** (`MATTERMOST_OUTGOING_TOKEN`) | Product menu → **Integrations → Outgoing Webhooks** → your webhook's **Token** (shown after you save it). |
| The **Callback URL** you paste INTO Mattermost's outgoing webhook | This project's **Settings → Integrations** → the Mattermost **inbound URL** (`https://lmthing.cloud/api/inbound/<your-token>/mattermost`). |

---

## Important: what THING can and can't receive

- **Sending is fully supported** — THING can post to and react in any channel its bot belongs to,
  any time.
- **Receiving is limited by Mattermost.** Outgoing webhooks only fire on **trigger words in public
  channels** — they do **not** fire in direct messages or private channels. So THING only sees
  public-channel messages that **start with** a trigger word you configured. Receiving *every*
  message (including DMs and private channels) would need an always-on bot with a live websocket
  connection, which isn't available on the free scale-to-zero pod.

---

## Troubleshooting

- **401 / "Invalid or expired session"** — the **Bot / access token** is wrong or was revoked.
  Recreate the bot token (step 3) and paste the new value.
- **403 when posting** — the bot isn't a member of that channel. Add it to the channel (step 4).
- **Webhook doesn't fire / THING never replies** — check that: your message is in the **public
  channel** the webhook is bound to; it **starts with** a configured **trigger word**; and the
  **Callback URL** exactly matches this project's Mattermost inbound URL (ending in `/mattermost`).
- **Replies show a blank or odd username** — enable **System Console → Integrations → Enable
  integrations to override usernames** (step 2.5).
- **No "Integrations" menu** — outgoing webhooks or bot accounts are disabled; enable them in
  **System Console → Integrations → Integration Management** (step 2), or ask your admin.
- Tokens are stored as private environment variables on your pod and never leave it.
