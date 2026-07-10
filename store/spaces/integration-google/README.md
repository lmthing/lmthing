# Connect Google (Calendar & Gmail)

This integration lets THING **read your Google Calendar and Gmail** using an access token you generate yourself. The quickest way to get one — no coding, no cloud project — is Google's official **OAuth Playground**.

It takes about 3 minutes.

> ⚠️ **Heads up:** a Playground access token is **short-lived (about 1 hour)**. It's perfect for trying the integration out. For a long-running setup you'll want a token from your own Google Cloud OAuth app (see the note at the bottom).

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Access token** (`GOOGLE_ACCESS_TOKEN`) | A temporary key that lets THING call Google APIs as you | `ya29.a0Af...` |

---

## Step-by-step (OAuth Playground)

### 1. Open the Playground
Go to **[developers.google.com/oauthplayground](https://developers.google.com/oauthplayground/)**.

### 2. Pick the scopes (what THING may access)
In the left **Step 1 — Select & authorize APIs** box, paste these into the input and add each:

```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/gmail.readonly
```

(Use `.../auth/calendar` instead of `calendar.readonly` if you also want THING to **create** calendar events.)

### 3. Authorize
1. Click **Authorize APIs**.
2. Sign in with the Google account you want to connect and click **Allow**.
3. You may see an "unverified app" warning — that's Google's own Playground; click **Continue**.

### 4. Get the access token
1. You're now on **Step 2**. Click **Exchange authorization code for tokens**.
2. Copy the value of **Access token** (it starts with `ya29.`).
3. Paste it into the **Access token** field on this page.

### 5. Save
Click **Save & Restart Pod** at the bottom. Wait ~30 seconds, then ask THING to *"list my next 3 Google Calendar events."*

---

## When the token stops working (~1 hour)

The Playground token expires after about an hour — THING will start getting **401 Unauthorized** from Google. Just repeat steps 3–5 to mint a fresh one and Save again.

## For a permanent connection (advanced)

Create your own OAuth app for a token you can refresh automatically:
1. In **[Google Cloud Console](https://console.cloud.google.com/)** create a project.
2. Enable the **Google Calendar API** and **Gmail API**.
3. Configure the **OAuth consent screen** and create an **OAuth client ID** (type: Web app).
4. Use it to obtain an access token (you can even plug your own Client ID/Secret into the Playground via its ⚙️ settings → *Use your own OAuth credentials*).

## Troubleshooting

- **401 Unauthorized** — the token expired; generate a new one (steps 3–5).
- **403 / insufficient scope** — you didn't add the scope for what you asked (step 2); re-authorize with the right scope.
- Your token is stored as a private environment variable on your pod and never leaves it.
