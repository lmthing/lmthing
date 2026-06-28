# `POST /api/auth/login` fails — Zitadel password grant disabled

On production, `POST /api/auth/register` works (creates the Zitadel user +
LiteLLM provisioning, returns `{ user_id, api_key }`), but the matching
`POST /api/auth/login` with the same credentials returns:

```json
{"error":"password not supported"}
```

So there is **no email/password path to obtain a gateway JWT** — register
succeeds but the account can't log in. The Zitadel instance/app appears to not
have the password grant / login flow enabled for the OIDC client used by
`loginWithPassword` (`cloud/gateway/src/lib/zitadel.ts`). GitHub OAuth (IDP
Intent) presumably still works; password login does not.

Impact: automated/QA testing can't use register→login. Workaround used this
session: mint a gateway HS256 JWT directly with `GATEWAY_JWT_SECRET`
(`cloud/gateway/src/lib/tokens.ts` shape) for the registered `user_id` and inject
it into `localStorage.lmthing_session`.

## To fix (open)
- Enable the password grant / login flow on the Zitadel OIDC app, OR
- Remove/replace the email-password register+login UI if only OAuth is intended
  (currently `/register` advertises a password that can never be used to log in).
- If keeping password auth, add an integration test that register→login→`/me`
  round-trips on a real Zitadel.
