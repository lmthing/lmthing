# billing: free tier's LLM budget is 15x a paying Basic's (monetization inversion)

**Symptom:** `TIERS.free` grants budget windows of **$10/1d, $50/7d, $150/30d** while paying tiers
get: basic $1/$4/$10, pro $3/$10/$20, max $10/$30/$100. A free account has 15x the 30-day spend
headroom of a Basic subscriber and 1.5x a Max ($100/mo) subscriber. Combined with the unthrottled
`POST /api/auth/register` (no rate limit anywhere on the auth surface — the token-bucket middleware
is wired only to `/api/status`), unbounded account creation is unbounded LLM spend.

**Direction:** reprice free well below basic (the tiers comment says tiers "differ only by their
budget windows"); add a vitest invariant `monthly(free) < monthly(basic) <= monthly(pro) <=
monthly(max)` so the inversion can't silently return; push to live keys with the existing
`cloud/scripts/resync-tier-budgets.ts`. Separately, apply the existing rate-limit middleware to
register/login/refresh/sso.

**Where:** `cloud/gateway/src/lib/tiers.ts:91-98` (free) vs `:118-155`;
`cloud/gateway/src/routes/auth.ts:62`; `cloud/gateway/src/middleware/rate-limit.ts`.
