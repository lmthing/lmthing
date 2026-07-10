# Auth (your own Twilio credentials, applied by the pod)

lmthing does **not** broker Twilio for you — you bring your own account. In **the project's
Settings → Integrations** the user pastes three values, which the pod stores as private environment
variables on the compute pod:

- `INTEGRATION_SMS_ACCOUNT_SID` — your account id, starts with `AC…`.
- `INTEGRATION_SMS_AUTH_TOKEN` — the account's Auth Token (secret).
- `INTEGRATION_SMS_FROM_NUMBER` — one of your Twilio numbers in E.164 (the default sender).

On every `callConnection('sms', ...)` the pod:

1. Pins the host to `https://api.twilio.com/2010-04-01/Accounts/<INTEGRATION_SMS_ACCOUNT_SID>` (the SID is
   substituted into the base path).
2. Adds an HTTP **Basic** `Authorization` header built from `INTEGRATION_SMS_ACCOUNT_SID` (username) +
   `INTEGRATION_SMS_AUTH_TOKEN` (password).
3. Forwards your relative `path` + `query`/`body` (form-encoded for writes).
4. Returns `{ ok, status, data }` — `status` is the HTTP status; **Twilio's own outcome is in
   `data`**: a success carries a `sid`, an error carries a numeric `code` + `message` (Twilio uses
   HTTP `400`/`401` for those).

If the credentials are missing, `callConnection` throws ("not configured — set INTEGRATION_SMS_AUTH_TOKEN in
Settings → Integrations"). If they are wrong you get `data.code === 20003` (authenticate failed). In
either case, tell the user to (re)enter their Twilio Account SID + Auth Token in **the project's
Settings → Integrations** — do not attempt to authenticate yourself and do not fabricate a result.

## Inbound (receiving texts)

Incoming SMS/MMS are delivered by Twilio to the user's lmthing inbound URL (configured on the number's
Messaging webhook — see the README). The pod verifies Twilio's `X-Twilio-Signature` header (an
HMAC-SHA1 of the request URL + sorted POST params, keyed by `INTEGRATION_SMS_AUTH_TOKEN`) before handing the
raw form payload to the `handler` agent. Verification is fully pod-side; the agent never checks
signatures.
