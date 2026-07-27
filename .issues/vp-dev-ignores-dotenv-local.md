# `vp dev` ignores `.env.local` / `VITE_*` env vars in `apps/web`

**Found:** 2026-07-27, while setting up a local dev server for the lmthing.team surface so
frontend fixes could be verified without a production deploy.

## Symptom

`sdk/org/apps/web` is served by `vp` (vite-plus, `"dev": "vp dev"` in
`sdk/org/apps/web/package.json`), not stock `vite`. Stock Vite loads `.env`, `.env.local`,
`.env.[mode]` from the project root and exposes any `VITE_`-prefixed key on
`import.meta.env`. `vp dev` does not — the file is read by nothing and the key is
`undefined` at runtime.

Reproduced:

```bash
cd sdk/org/apps/web
printf 'VITE_CLOUD_BASE_URL=https://lmthing.cloud\n' > .env.local
pnpm dev
# then, in the served page:
#   (await import('/src/lib/config.ts')).CLOUD_BASE_URL
#   → "http://localhost:5175"      (expected "https://lmthing.cloud")
```

`import.meta.env.VITE_CLOUD_BASE_URL` is `undefined`, so
[`src/lib/config.ts`](../sdk/org/apps/web/src/lib/config.ts) falls through its whole
override chain to `resolveApiOrigin(...)` and resolves the dev origin.

## Why it matters

Every override in `config.ts` — `VITE_CLOUD_BASE_URL`, `VITE_CLOUD_URL`,
`VITE_COMPUTER_BASE_URL`, `VITE_STRIPE_PUBLISHABLE_KEY` — exists precisely so local dev and
CI can point the SPA at an arbitrary origin. None of them work under `vp dev`. That file's
own docstring ("Each constant checks the corresponding VITE_* env-var override first so
local dev and CI can point at arbitrary origins") is therefore false for the dev server the
package actually ships.

The practical cost: verifying a frontend change against real backend data requires either a
deploy to production or a temporary hardcoded edit to `config.ts` (which then must not be
committed). Both are worse than the env var that was designed for it.

## Workaround in use

A commented `// TEMP local-only override, DO NOT COMMIT` literal in `config.ts`, reverted
before committing. Fragile — it is one forgotten `git add` away from shipping a hardcoded
production origin into the bundle.

## Fix candidates (unexplored)

1. Find whether `vp` has its own env-file convention or a flag that enables Vite's, and
   document it in `org/docs/devops/local-dev.md`.
2. Load the dotenv files explicitly in the app's vite config and hand them to `define`, so
   the behaviour no longer depends on which dev binary is in front.
3. Move the dev-origin decision out of env vars entirely — e.g. a gitignored
   `src/lib/config.local.ts` the chain imports — so there is nothing for the tool to ignore.

Option 2 is the one that makes the existing docstring true again without new conventions.
