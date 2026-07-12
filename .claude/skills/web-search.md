---
name: web-search
description: Load when touching agent web search, the webSearch/webFetch functions, search providers (Tavily/Bing/DuckDuckGo), or the in-cluster headless-browser render service.
---

# Skill: Web Search (webSearch + the render service)

Applies when you touch `webSearch`/`webFetch` (the `system-global` space functions agents use to
reach the live web), their provider chain (Tavily / Bing / DuckDuckGo), the HTML→text reduction and
`looksDynamic` render fallback, or the in-cluster **render service** (browserless/chromium) they POST
to — including its Deployment, NetworkPolicy, token, and the gateway env injection that lets pods
find it.

## Read first (the grounded truth)

- `org/docs/cloud/render.md` — **the page for this skill.** `webSearch`/`webFetch` signatures, the
  `auto` provider chain, the Bing parser + redirect decode, `render` modes and `looksDynamic`, the
  render-service Deployment / ClusterIP / NetworkPolicy / token, how the gateway injects
  `RENDER_SERVICE_URL` + `RENDER_SERVICE_TOKEN` into every pod, the sequential-yield dependency in
  the turn loop, the test inventory, and the gotchas.
- `org/docs/runtime-globals/events-and-integrations.md` — why `webSearch`/`webFetch` are **space
  functions, not globals**, how `system-global` injection works, and how a task's `functions:`
  allowlist (and a project agent's `tools:use.allow`) gates who may call them.
- `org/docs/system-spaces/README.md` — the `system-global` / `system-research` spaces themselves.

Do not re-derive any of the above from the source; read the doc, then the cited code.

## Procedure

Unit tests + typecheck — run from `sdk/org`, **not** the repo root:

```bash
cd sdk/org && pnpm test libs/core/src/spaces/system-functions.test.ts
pnpm --filter @lmthing/core typecheck
```

(`pnpm --filter @lmthing/core test` is a silent no-op — `@lmthing/core` has no `test` script.)

Probe the render service in prod (port-forward comes from the node, so it bypasses the
NetworkPolicy):

```bash
kubectl port-forward -n lmthing deploy/render 13000:3000
curl -X POST "http://127.0.0.1:13000/content?token=$TOK" \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.bing.com/search?q=test","gotoOptions":{"waitUntil":"domcontentloaded","timeout":15000}}'
```

Then parse the returned HTML locally with the `webSearchBing` logic.

Order of operations when changing a provider or the render path:

1. Edit the function (`sdk/org/libs/core/system-spaces/system-global/functions/`). The JSDoc **is**
   the model-facing type — the system-global overlay derives the agent DTS from source, so there is
   no separate `.d.ts` to update.
2. Add/extend the case in `sdk/org/libs/core/src/spaces/system-functions.test.ts` and run the
   commands above. The Bing/render path only works **through the runtime** (it relies on the
   sandbox's synchronous `response.text()`), so test it there or run the pure parser against
   separately-fetched HTML.
3. If infra changed (`devops/argocd/core/render.yaml`, secrets, gateway env), redeploy and re-probe
   with the port-forward above.
4. Live agent path: run a `system-research` action on a compute pod whose `user-env` carries
   `RENDER_SERVICE_URL`/`RENDER_SERVICE_TOKEN` (injected on `/api/compute/ensure`). Debug a
   system-global fn on a pod with the CLI's `--mock` handler; `console` is not in the agent DTS, so
   surface results with `writeFileRaw("/tmp/…")` and read them back. `--request` is single-shot — it
   only keeps resuming while a statement yields, so chain each non-yielding write with the next
   fetching call.
5. Update `org/docs/cloud/render.md` in the same change.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the
same change (see org/docs/SYNC.md).
