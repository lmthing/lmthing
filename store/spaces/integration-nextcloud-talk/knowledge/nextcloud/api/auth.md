# Auth — BYO bot secret (signed by the pod)

lmthing does **not** broker OAuth for Nextcloud. The user creates their own **Talk bot** on their
Nextcloud server (via the `occ talk:bot:install` command) with a shared secret, and pastes two values
into **the project's Settings → Integrations**:

- **`INTEGRATION_NEXTCLOUD_TALK_BASE_URL`** — their Nextcloud site URL (e.g. `https://cloud.example.com`).
- **`INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET`** — the shared secret they chose when installing the bot.

Both become private environment variables on the user's pod.

On every `callConnection('nextcloud', ...)` the pod:

1. Pins the host to `<INTEGRATION_NEXTCLOUD_TALK_BASE_URL>/ocs/v2.php/apps/spreed/api/v1` and appends your relative
   `path`.
2. Applies the **`nextcloud-bot`** auth style: it generates a random value, computes
   `HMAC-SHA256(random + <message field of the body>, INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET)`, and sets the
   `X-Nextcloud-Talk-Bot-Random` and `X-Nextcloud-Talk-Bot-Signature` headers. **The agent does not
   sign anything** — just call the wrapper functions.
3. Forwards your `body` and headers (the wrappers always add `OCS-APIRequest: true` and
   `Accept: application/json`).
4. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response, and Nextcloud's own
   result is inside `data` as the OCS envelope `{ ocs: { meta: { status, statuscode, message }, data } }`.

If the secret is missing, `callConnection` throws ("not configured — set INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET …").
If the secret is wrong, Nextcloud rejects the signature and `ocs.meta.statuscode` is `401`. If the bot
has not been enabled in the target conversation (`occ talk:bot:setup <botId> <roomToken>`),
`ocs.meta.statuscode` is `404`. In any of these cases, ask the user to fix the value in
**the project's Settings → Integrations** (or run the missing `occ` command) — do not authenticate
yourself and do not fabricate a result.

## Inbound (webhook) verification

For inbound events the pod verifies the signature itself from the `webhook` descriptor: Nextcloud sends
`X-Nextcloud-Talk-Signature` = `HMAC-SHA256(X-Nextcloud-Talk-Random + <raw body>, INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET)`.
The user just registers the lmthing inbound URL as the bot's webhook URL when running
`occ talk:bot:install`; the same `INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET` verifies both directions.
