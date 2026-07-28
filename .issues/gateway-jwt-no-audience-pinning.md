# security: verifyAccessToken does not pin an audience — pod tokens are one claim away from being user sessions

**Symptom:** `verifyAccessToken` calls `jwtVerify(token, secret)` with no `audience` option, unlike
`verifyBackupToken`/`verifyComputeToken`/`verifyInboundToken`, which all pin `{ audience: ... }`.
All tokens share one symmetric `GATEWAY_JWT_SECRET`. The only thing stopping a 365-day
`aud:"compute"`/`aud:"backup"`/`aud:"inbound"` pod token from passing as a full user session is that
its payload happens to lack an `email` claim. Adding `email` to any pod token — a harmless-looking
logging change — would silently convert it into a year-long session token. The comment at
`tokens.ts:68-70` reasons about this only for team tokens; the general invariant is undefended.

**Direction:** stamp `.setAudience("user")` in `signTokens` and pass `{ audience: "user" }` in
`verifyAccessToken`, so token classes are separated by an explicit assertion rather than by the
incidental absence of a claim. Add a test asserting a compute/backup/inbound token is rejected by
`verifyAccessToken` even when given an `email` claim.

**Where:** `cloud/gateway/src/lib/tokens.ts:32-42` (verify), signing in the same file.
