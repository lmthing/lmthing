# `POST /api/auth/login` fails — Zitadel password grant disabled

On production, `POST /api/auth/register` works (creates the Zitadel user +
LiteLLM provisioning, returns `{ user_id, api_key }`), but the matching
`POST /api/auth/login` with the same credentials returns:

```json
{"error":"password not supported"}
```

The Zitadel instance/app appears to not have the password grant / login flow
enabled for the OIDC client used by `loginWithPassword`
(`cloud/gateway/src/lib/zitadel.ts`). GitHub OAuth (IDP Intent) is unaffected.

## No longer blocking

There **is** now an email path to a gateway JWT — it just doesn't use a password.
`POST /api/auth/email/start` mails a 6-digit code plus a magic link to any
address, and `POST /api/auth/email/verify` exchanges the code for a session,
creating the account on first sign-in (`cloud/gateway/src/routes/auth.ts`; docs:
`org/docs/cloud/auth.md`). Automated and QA testing should use that instead of
register→login.

Two things keep this issue open rather than closed:

- `/register` + `/login` are still advertised (and `com/src/lib/cloud.ts` still
  wraps both) while `/login` can never succeed.
- Email sign-in needs a mail transport in the deployment (`RESEND_API_KEY`, or
  the `SMTP_*` group, in `lmthing-secrets`). Until one is set,
  `POST /api/auth/email/start` answers `503` and the testing fallback is still to
  mint a gateway HS256 JWT directly with `GATEWAY_JWT_SECRET`
  (`cloud/gateway/src/lib/tokens.ts` shape) and inject it into
  `localStorage.lmthing_session`.

## To fix (open)
- Set a mail transport in `lmthing-secrets` so email sign-in is live in
  production. This is a deploy step, not a code change — the gateway already
  reads every key as an optional `secretKeyRef`.
- Then either enable the password grant on the Zitadel OIDC app, OR remove
  `/register` + `/login` and their `cloud.ts` wrappers, since passwordless email
  now covers what they were meant to do.
- If password auth is kept, add an integration test that register→login→`/me`
  round-trips on a real Zitadel.
