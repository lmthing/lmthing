# security: DELETE /api/keys/:token revokes any user's LiteLLM key (IDOR)

**Symptom:** `keys.delete("/:token")` passes the path param straight to `litellm.deleteKey(token)`
with no check that the key belongs to the authenticated caller. Every sibling route on the same
router scopes by `user.id`; this one does not. Any authenticated user who learns another user's key
id can revoke it.

**Direction:** before deleting, resolve the key via `litellm.listKeys(user.id)` (or equivalent
ownership lookup) and 404 when it isn't the caller's. Same authorization gap exists on
`GET /api/billing/checkout/status` (`cloud/gateway/src/routes/billing.ts:205-216`), which returns
any Stripe Checkout session by id — assert the session's customer matches the caller.

**Where:** `cloud/gateway/src/routes/keys.ts:61-66`.
