# Connect SMS (Twilio)

This integration lets THING **send text messages from your phone number** and **reply to texts people
send you**, using your own [Twilio](https://www.twilio.com) account. You paste three values from the
Twilio Console into the fields on this page, then point your Twilio number's webhook at lmthing.

It takes about 10 minutes. Follow every step.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Account SID** (`INTEGRATION_SMS_ACCOUNT_SID`) | Your Twilio account id | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| **Auth Token** (`INTEGRATION_SMS_AUTH_TOKEN`) | The secret that authorizes API calls **and** verifies inbound webhooks | a 32-character string |
| **Your Twilio number** (`INTEGRATION_SMS_FROM_NUMBER`) | The phone number you send from, in E.164 | `+15551234567` |

E.164 just means: a `+`, the country code, then the number, with **no spaces or dashes** (e.g.
`+15551234567`, `+447700900123`).

---

## Step-by-step

### 1. Create a Twilio account
1. Go to **[twilio.com](https://www.twilio.com)** and sign up (a free trial gives you a small credit
   and one phone number). Verify your email and your own mobile number when asked.
2. You land in the **Twilio Console** at **[console.twilio.com](https://console.twilio.com)**.

### 2. Copy your Account SID and Auth Token
1. On the Console **dashboard** (home page), find the **Account Info** panel (bottom of the page).
2. Copy the **Account SID** (starts with `AC…`) → paste it into the **Account SID** field here.
3. Next to it, click **Show** on the **Auth Token**, copy it → paste it into the **Auth Token** field
   here. Keep this secret; anyone with it can send texts on your account.

### 3. Get a phone number
1. In the left menu open **Phone Numbers → Manage → Active numbers**. (Trial accounts get one number
   automatically — it's listed here.)
2. If you don't have one, click **Buy a number**, pick a number with the **SMS** capability (choose
   **MMS** too if you want to send/receive images), and buy it.
3. Copy the number in **E.164** form → paste it into the **Your Twilio number** field here (e.g.
   `+15551234567`).

### 4. Save
Click **Save & Restart Pod** at the bottom of this page. Wait ~30 seconds for the pod to restart, then
ask THING to *"text +1 555 123 4567 saying hello."* (use a number you can check — on a trial account
it must be a number you've **verified** in the Console).

### 5. Point Twilio at lmthing (to receive texts)
So THING can **reply to incoming texts**, tell Twilio where to deliver them:
1. Copy the **inbound URL** shown on this **Settings → Integrations** page for SMS. It looks like:
   `https://lmthing.cloud/api/inbound/<your-token>/sms`
2. Back in the Twilio Console, open **Phone Numbers → Manage → Active numbers** and click your number.
3. Scroll to the **Messaging Configuration** section (labelled "Configure with… Webhook, TwiML Bin,
   Function…" — keep it on **Webhook**).
4. Under **"A message comes in"**: paste your inbound URL into the URL box, and set the method dropdown
   to **HTTP POST**.
5. Click **Save configuration** at the bottom.

Now text your Twilio number from your phone — THING should reply within a few seconds.

---

## What goes where

| Where in Twilio | Copy into this page |
|---|---|
| Console dashboard → **Account Info** → Account SID | **Account SID** (`INTEGRATION_SMS_ACCOUNT_SID`) |
| Console dashboard → **Account Info** → Auth Token (click *Show*) | **Auth Token** (`INTEGRATION_SMS_AUTH_TOKEN`) |
| Phone Numbers → Manage → **Active numbers** → your number (E.164) | **Your Twilio number** (`INTEGRATION_SMS_FROM_NUMBER`) |
| This page's **inbound URL** (`…/sms`) → paste into the number's **"A message comes in"** webhook (HTTP POST) | *(no field — configured in Twilio)* |

---

## Troubleshooting

- **THING says "not configured"** — you haven't saved your Account SID + Auth Token yet, or the pod
  hasn't restarted. Re-enter them and **Save & Restart Pod**.
- **Error `20003` (authenticate)** — the Account SID or Auth Token is wrong. Recopy both from the
  Console Account Info panel (regenerate the Auth Token there if unsure).
- **Error `21608` / can't text a number** — on a **trial** account you can only send to phone numbers
  you've **verified** in the Console (Phone Numbers → Manage → Verified Caller IDs), and messages carry
  a trial prefix. Upgrade the account to text anyone.
- **Error `21211`** — the recipient number isn't valid E.164. Use `+`, country code, then digits, no
  spaces/dashes.
- **Error `21606` / `21659`** — the "from" number isn't an SMS-capable Twilio number you own. Check
  `INTEGRATION_SMS_FROM_NUMBER` matches a number under **Active numbers** with the SMS capability.
- **Incoming texts don't reach THING** —
  - Confirm the number's **"A message comes in"** webhook is set to your `…/sms` inbound URL with
    method **HTTP POST** (step 5), and that you clicked **Save configuration**.
  - In the Console open **Monitor → Logs → Errors**. An **11200** (HTTP retrieval failure) or **11205**
    means Twilio couldn't reach the URL — recheck the URL for typos.
  - A **401 / signature** failure means the **Auth Token** you saved here doesn't match your account
    (or was rotated). Recopy the current Auth Token and **Save & Restart Pod**. (lmthing verifies
    Twilio's signature using this token, so it must be current.)
- **MMS (images)** — sending/receiving media works best for **US/Canada** numbers; in many other
  regions Twilio delivers an MMS as an SMS containing a link. Make sure your number has the **MMS**
  capability if you want to send images.

---

## For automations — the `message.received` event

Once connected (Account SID + Auth Token + number saved, and your Twilio number's **"A message comes
in"** webhook pointed at your `…/sms` inbound URL — see step 5 above), every inbound **text** message
this space emits an event you can hook from any project:

**`integration-sms/message.received`**

| Payload field | Type | Value |
|---|---|---|
| `text` | `string` | The message body the person texted. |
| `from` | `string` | The sender's phone number in E.164 (Twilio's `From`) — who you reply to. |
| `chatId` | `string` | Same as `from` — SMS has no channel/room, so you reply to the sender's number. |
| `userName` | `string?` | Not set — SMS carries no display name. |
| `threadKey` | `string?` | Not set — SMS has no threading model (each text is one-shot). |
| `raw` | `object` | `{ From, To, MessageSid, AccountSid }` — the key fields from Twilio's form POST. |

Only real, incoming text messages are emitted. Twilio's delivery/status callbacks (which carry no
`Body`) are ignored — `emit` returns nothing for them.

Signature verification is handled pod-side: the gateway forwards the original request URL as the
`x-lmthing-inbound-url` header, and the verify engine reconstructs Twilio's `x-twilio-signature`
(base64 HMAC-SHA1 over that URL plus the sorted form params, keyed by your Auth Token). The space only
declares `verify: { type: 'twilio' }` — you configure nothing.

### Automate "when a text arrives, do X"

Ask THING something like *"when someone texts me, reply with a short answer"* and the automator writes
a project event hook subscribed to this event. The hook reads `ctx.input` and replies via the space's
`smsSend` wrapper (which wraps `callConnection('sms', …)`), texting the sender back from your own
Twilio number:

```ts
// hooks/sms-reply.ts — on:{ event: 'integration-sms/message.received' }
export default async function (ctx) {
  const input = ctx.input; // { text, from, chatId, raw: { From, To, MessageSid, AccountSid } }
  const answer = `You said: ${input.text}`;
  // reply TO the sender (input.chatId / input.from) FROM the number they texted (raw.To)
  const res = await smsSend(input.chatId, answer, input.raw.To);
  // on failure Twilio returns { code, message } — surface it, don't claim success
}
```

Keys (Account SID + Auth Token + your Twilio number) and a registered SMS webhook URL are still
required for events to flow — follow the steps above first.

---

Your Account SID, Auth Token, and number are stored as private environment variables on your pod and
never leave it.
