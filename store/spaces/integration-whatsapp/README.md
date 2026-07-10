# Connect WhatsApp

This integration lets THING **send WhatsApp messages from your business number** and **reply to
WhatsApp messages people send you**. It uses the official **WhatsApp Cloud API** (hosted by Meta) —
not an unofficial library. To connect it you create a free Meta developer app, add the WhatsApp
product, and copy four values into the fields on this page.

It takes about 10–15 minutes. Follow every step.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Access token** (`WHATSAPP_TOKEN`) | Lets THING send messages as your business number | a long `EAAG...` string |
| **Phone number ID** (`WHATSAPP_PHONE_ID`) | Which WhatsApp number to send from (NOT the phone number itself) | a 15-digit number like `123456789012345` |
| **App secret** (`WHATSAPP_APP_SECRET`) | Lets us verify that incoming messages really come from Meta | a 32-character hex string |
| **Webhook verify token** (`WHATSAPP_VERIFY_TOKEN`) | A password YOU invent; you type the same value into Meta | anything random, e.g. `my-lmthing-2026-abc` |

---

## Step-by-step

### 1. Create a Meta app
1. Open **[developers.facebook.com/apps](https://developers.facebook.com/apps)** and log in (create a
   free developer account if prompted).
2. Click **Create app**.
3. For **What do you want your app to do?** choose **Other**, then pick app type **Business**, and
   click **Next**.
4. Give it a name (e.g. *THING*), confirm your email, and click **Create app**.

### 2. Add the WhatsApp product
1. On your app's dashboard, find **WhatsApp** in the product list and click **Set up**.
2. If asked, select or create a **Meta Business Account** and continue.
3. You now land on **WhatsApp → API Setup** (sometimes called *Getting Started*).

### 3. Copy the Phone number ID and the Access token
On the **WhatsApp → API Setup** page:
1. Under **Send and receive messages** you'll see a test **From** number with its **Phone number
   ID** beneath it. Copy the **Phone number ID** → paste into the **Phone number ID** field here.
2. Just above, copy the **Temporary access token** → paste into the **Access token** field here.
   - This temporary token expires in **24 hours** — fine for a first test. For everyday use, create a
     permanent token (see **Making the token permanent** below) and replace it here.

### 4. Copy the App secret
1. In the left sidebar go to **App settings → Basic**.
2. Find **App secret** → click **Show** (re-enter your password if asked) → copy it.
3. Paste it into the **App secret** field here.

### 5. Invent a Verify token
1. Make up any random string — e.g. `my-lmthing-2026-abc`. It's just a shared password between Meta
   and lmthing.
2. Paste it into the **Webhook verify token** field here.
3. Keep it handy — you'll type the SAME value into Meta in step 7.

### 6. Save
Click **Save & Restart Pod** at the bottom of this page. Wait ~30 seconds for the pod to restart.
This also activates the inbound URL you'll need next.

### 7. Point Meta's webhook at lmthing
1. In this project's **Settings → Integrations**, copy your **inbound URL** for WhatsApp. It looks
   like:
   ```
   https://lmthing.cloud/api/inbound/<your-token>/whatsapp
   ```
   (it ends in `/whatsapp`).
2. Back in Meta, go to **WhatsApp → Configuration** (or **API Setup → Webhooks**) and click **Edit**
   next to **Callback URL**.
3. **Callback URL** → paste the inbound URL from step 1.
4. **Verify token** → paste the SAME random string you invented in step 5.
5. Click **Verify and save**. Meta sends a one-time GET check; the pod answers it automatically using
   your verify token, and the webhook turns green.
6. Still on **Configuration**, in the **Webhook fields** table find **messages** and click
   **Manage → Subscribe** (the toggle must be on). This is what makes Meta actually deliver incoming
   messages to lmthing.

### 8. Test it
1. On **API Setup**, use the **To** box to add your own personal WhatsApp number as a test recipient
   (Meta will send it a confirmation code).
2. Message your business number from that phone.
3. THING should reply in the same WhatsApp chat. You can also ask THING here to *"send a WhatsApp to
   +15551234567 saying hello"* (only works within 24 hours of that person messaging you — see below).

---

## Making the token permanent (recommended)

The temporary token from step 3 dies after 24 hours. For a token that doesn't expire:

1. Go to **[business.facebook.com](https://business.facebook.com)** → **Settings → Users → System
   users**.
2. Click **Add**, create a System User (give it the **Admin** role), and **Assign** your app to it
   with full control.
3. Click **Generate new token**, choose your app, select the permissions
   **`whatsapp_business_messaging`** and **`whatsapp_business_management`**, and generate.
4. Copy the token and paste it into the **Access token** field here, then **Save & Restart Pod**.

A System User token does not expire, so THING keeps working without you re-copying tokens.

---

## The 24-hour rule (why a send might not go through)

WhatsApp only lets a business send **free-form** messages (plain text/images) to a person within
**24 hours** of that person's last message to you. This is the *customer-service window*.

- Replying to someone who just messaged you → works fine (THING does this automatically).
- Messaging someone out of the blue, or after 24 hours of silence → you must use an **approved
  message template**. Create templates in **WhatsApp Manager → Account tools → Message templates**;
  once approved, ask THING to send that template.

---

## Troubleshooting

- **Webhook verification failed / "The callback URL couldn't be validated"** — the **Verify token**
  in Meta doesn't exactly match the one you entered here (step 5 vs step 7), or you saved this page
  after entering it. Make them identical, re-save the pod, then retry **Verify and save** in Meta.
- **No incoming messages reach THING** — you didn't **Subscribe** to the **messages** field in
  **WhatsApp → Configuration** (step 7.6). Toggle it on.
- **Error code `190` (token expired/invalid)** — the temporary token lapsed after 24 hours. Generate
  a permanent System User token (see above) and paste it in.
- **Error code `131047` (outside the 24-hour window)** — you're trying to message someone who hasn't
  written in the last 24 hours. Use an approved template instead.
- **Error code `131030` (recipient not in allowed list)** — while your number is in test mode you can
  only message numbers you've added as test recipients on the API Setup page. Add the number, or take
  your number live.
- **Error code `100` (invalid parameter)** — usually a badly formatted recipient number. Use full
  international format with no `+`, spaces, or dashes (e.g. `15551234567`).

Your tokens are stored as private environment variables on your pod and never leave it.
