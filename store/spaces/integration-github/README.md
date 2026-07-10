# Connect GitHub

This integration lets THING **create issues, search code, and list pull requests** on your GitHub repositories. To connect it you create a **fine-grained personal access token** (a scoped password for apps) and paste it into the field on this page.

It takes about 3 minutes.

---

## What you'll need

| Field on this page | What it is | Required? | Looks like |
|---|---|---|---|
| **Personal access token** (`GITHUB_TOKEN`) | Lets THING act on GitHub as you | **Yes** | `github_pat_...` |
| **Webhook secret** (`GITHUB_WEBHOOK_SECRET`) | Only if you want THING to react to GitHub events | No | any random string you choose |

---

## Step-by-step

### 1. Open the token page
Go to **[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)**.

(Manual path: **GitHub → your avatar → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.)

### 2. Name it and set an expiry
1. **Token name**: e.g. *THING*.
2. **Expiration**: pick a duration (e.g. 90 days). You'll re-create it when it expires.

### 3. Choose which repositories THING can touch
Under **Repository access** pick **Only select repositories** and choose the repos you want THING to work with. (Avoid *All repositories* unless you really need it.)

### 4. Grant the permissions
Under **Permissions → Repository permissions**, set:

| Permission | Access | Why |
|---|---|---|
| **Contents** | Read-only | search / read code |
| **Issues** | Read and write | create & update issues |
| **Pull requests** | Read-only | list PRs |
| **Metadata** | Read-only | *(auto-selected — required)* |
| **Webhooks** | Read and write | *only if you'll receive GitHub events* |

### 5. Generate and copy
1. Click **Generate token**.
2. Copy the token (it starts with `github_pat_`). **You will not be able to see it again.**
3. Paste it into the **Personal access token** field on this page.

### 6. Save
Click **Save & Restart Pod** at the bottom. Wait ~30 seconds, then ask THING to *"open a GitHub issue titled Test in my repo."*

---

## Optional: receiving GitHub events

To have THING **react to GitHub webhooks** (new issues, pushes, …):
1. Make up any random string as a **webhook secret** and paste it into the **Webhook secret** field here.
2. In your repo: **Settings → Webhooks → Add webhook**, set the **Payload URL** to the GitHub trigger URL from your project's **Triggers** settings tab, set **Content type** to `application/json`, and paste the **same secret**.

## Troubleshooting

- **404 / "Not Found" on a repo** — the token wasn't granted access to that repo (step 3).
- **403 / "Resource not accessible"** — a required permission is missing (step 4); re-generate the token.
- **Token expired** — create a new one and paste it in again.
- Your token is stored as a private environment variable on your pod and never leaves it.
