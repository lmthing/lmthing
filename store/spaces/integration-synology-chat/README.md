# Connect Synology Chat

This integration lets THING **send messages to your Synology Chat** and **reply to messages people
send your Synology Chat bot**. To connect it you create two webhooks inside Synology Chat on your own
NAS and copy three values into the fields on this page.

It takes about 10 minutes. Follow every step.

---

## What you'll need

You will create **two** webhooks in Synology Chat:

- an **Incoming Webhook** — lets THING push messages INTO Synology Chat. It gives you a URL that
  contains a `token`.
- an **Outgoing Webhook** — lets Synology Chat send messages people type back OUT to THING. It gives
  you its own `token`.

| Field on this page | What it is | Where it comes from |
|---|---|---|
| **NAS base URL** (`INTEGRATION_SYNOLOGY_CHAT_BASE_URL`) | The address of your NAS | The **start** of the Incoming Webhook URL — everything before `/webapi/...` (e.g. `https://nas.example.com:5001`) |
| **Incoming webhook token** (`INTEGRATION_SYNOLOGY_CHAT_TOKEN`) | Lets THING send messages in | The `token=` value at the **end** of the Incoming Webhook URL |
| **Outgoing webhook token** (`INTEGRATION_SYNOLOGY_CHAT_OUTGOING_TOKEN`) | Lets us verify messages Synology sends back are genuine | The **token** shown when you create the Outgoing Webhook |

---

## Step-by-step

### 1. Open Chat Integration
1. In Synology Chat (in your browser, or the desktop/mobile app), click your **profile picture** in the
   top-right and choose **Integration**. (Admins can also reach it from the Chat admin console.)
2. You'll see tabs/buttons for **Incoming Webhooks**, **Outgoing Webhooks**, **Slash Commands**, and
   **Bots**.

### 2. Create the Incoming Webhook (THING → Synology)
1. Click **Create** under **Incoming Webhooks**.
2. Give it a name (e.g. *THING*) and pick the **channel** THING should post into. Click **OK / Submit**.
3. Synology shows a **Webhook URL** that looks like:

   ```
   https://nas.example.com:5001/webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2&token=abcd1234EXAMPLE
   ```

4. **Split this URL into two fields on this page:**
   - Everything **before** `/webapi/` → paste into **NAS base URL**
     (here: `https://nas.example.com:5001`). Do **not** include a trailing slash.
   - The value after `token=` at the **very end** → paste into **Incoming webhook token**
     (here: `abcd1234EXAMPLE`).

   > Tip: the base URL is just your NAS's address and port — the same address you use to open DSM in
   > your browser.

### 3. Create the Outgoing Webhook (Synology → THING)
1. Back in **Integration**, click **Create** under **Outgoing Webhooks**.
2. Give it a name (e.g. *THING replies*) and pick the **same channel** (and/or set a trigger keyword if
   you want the bot to answer only certain messages).
3. In the **Outgoing URL** field, paste the inbound URL shown on **this** page under
   **Settings → Integrations** — it looks like:

   ```
   https://lmthing.cloud/api/inbound/<your-inbound-token>/synology
   ```

   (It always ends in `/synology`.)
4. Click **OK / Submit**. Synology now shows a **token** for this outgoing webhook.
5. Copy that **token** and paste it into **Outgoing webhook token** on this page.

### 4. Save
Click **Save & Restart Pod** at the bottom. Wait ~30 seconds for the pod to restart, then:

- ask THING to *"send a hello to my Synology Chat"* — it should appear in the channel; and
- in Synology Chat, message the bot's channel — THING should reply to you as a **direct message**.

---

## How replies work

Synology Chat's bot surface is limited: an incoming webhook can only push into one channel, and there
is no "reply in thread" API. So when someone messages your bot, THING answers with a **private direct
message to that person** (using their `user_id` from the outgoing-webhook event). That's expected — it
is the only reply path Synology offers.

## Troubleshooting

- **Nothing arrives in Synology when THING sends** — check the **NAS base URL** and **Incoming webhook
  token** are split correctly from the webhook URL (base = before `/webapi/`, token = after `token=`).
- **`401` / token error** — the incoming-webhook token is wrong or was regenerated. Recreate/copy the
  Incoming Webhook URL and re-paste both the base URL and token.
- **Certificate / TLS error** — many NAS boxes use a self-signed HTTPS certificate. Use a hostname the
  certificate covers in **NAS base URL**, or install a trusted certificate on the NAS.
- **THING never replies to inbound messages** — the **Outgoing webhook token** on this page must match
  the token Synology showed when you created the Outgoing Webhook, and the Outgoing URL in Synology
  must be exactly the inbound URL from this page (ending in `/synology`).
- **The NAS can't reach lmthing** — the outgoing webhook is sent by your NAS, so your NAS needs
  outbound internet access to `https://lmthing.cloud`.
- All three values are stored as private environment variables on your pod and never leave it.
