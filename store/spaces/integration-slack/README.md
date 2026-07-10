# Connect Slack

This integration lets THING **post messages to your Slack** and **react to Slack messages**. To connect it you create a small (free) Slack app in your own workspace and copy two secrets into the fields on this page.

It takes about 5 minutes. Follow every step.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Bot token** (`SLACK_BOT_TOKEN`) | Lets THING act as a bot in your workspace | `xoxb-1234...` |
| **Signing secret** (`SLACK_SIGNING_SECRET`) | Lets us verify messages Slack sends back are genuine | a 32-character string |

---

## Step-by-step

### 1. Create a Slack app
1. Open **[api.slack.com/apps](https://api.slack.com/apps)** and sign in.
2. Click **Create New App** → **From scratch**.
3. Give it a name (e.g. *THING*), pick your **workspace**, and click **Create App**.

### 2. Copy the Signing Secret
1. You land on **Basic Information**.
2. Scroll to **App Credentials** → find **Signing Secret** → click **Show** → copy it.
3. Paste it into the **Signing secret** field on this page.

### 3. Give the bot permissions
1. In the left sidebar click **OAuth & Permissions**.
2. Scroll to **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope**.
3. Add these three:
   - `chat:write` — post messages
   - `channels:read` — see your channels
   - `channels:history` — read messages in channels

### 4. Install the app & copy the Bot token
1. Scroll back up on the same page to **OAuth Tokens for Your Workspace**.
2. Click **Install to Workspace** → **Allow**.
3. Copy the **Bot User OAuth Token** (it starts with `xoxb-`).
4. Paste it into the **Bot token** field on this page.

### 5. Invite the bot to a channel
In Slack, open the channel you want THING to post in and type:

```
/invite @THING
```

(use whatever you named the app). A bot can only post in channels it's a member of.

### 6. Save
Click **Save & Restart Pod** at the bottom. Wait ~30 seconds for the pod to restart, then ask THING to *"post a hello to #general in Slack."*

---

## Optional: receiving Slack messages

If you also want THING to **react to incoming Slack events**, point your Slack app's **Event Subscriptions → Request URL** at the Slack trigger URL shown in your project's **Triggers** settings tab. The **Signing secret** you already entered is what verifies those events.

## Troubleshooting

- **`not_in_channel`** — invite the bot to the channel (step 5).
- **`invalid_auth`** — the Bot token is wrong or the app was re-installed; recopy the `xoxb-` token.
- **`missing_scope`** — add the missing scope (step 3) and **re-install** the app (step 4).
- Tokens are stored as private environment variables on your pod and never leave it.
