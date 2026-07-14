# PROGRESS — scenario-campaign · task `06-tanzania` · round 2

_Started 2026-07-14T07:31:58.559Z. The agent MUST update this file at every step._

Round 2 = ADD ACTS (batch 2). Baseline: round 1 ended an **honest FAIL** (Acts I + XIII pass; II–XII,
XIV red), 9 product fixes landed AFTER that run (so most red Acts are unmeasured since), and one
high-severity open issue: **every served app renders blank**.

## Steps

- **Oriented.** Read `scenario.md` (Acts I–XIV + Actual results), `results/checkpoint.json`,
  `.issues/served-app-renders-blank-asset-404.md`. Ran a read-only catalog-scout subagent: all five
  fixture kinds already exist; never-covered catalog areas that fit this persona are **J** (dismissed
  `ask()` → null, ask security guards, space view/form components), **L** (`db.addColumn` live
  migration, capability gating AT TYPECHECK), **M** (scanned-PDF `readDocument` failure → vision
  fallback; history summarization), **P** (loop guard, payload validation, session-ledger).
- **Root-caused the blank-app bug** (read-only subagent, then confirmed in source): the clean-URL root
  mount `/:projectId/*` in `serve.ts` was registered **only** when `LMTHING_GATEWAY_URL` was set. On a
  pod whose `user-env` Secret predated that var, `/<project>/` matched no route, fell to the SPA
  catch-all and answered **200 with the pod's own shell** — whose bundle is root-absolute
  `/assets/index-*.js` → 404 under the app mount → blank page; and `/<project>/api/<route>` returned
  that same HTML instead of JSON. One cause, all three symptoms. The page builder was innocent.
- **Fixed it in the product.** The root mount is now **always registered** and **falls through** to the
  SPA when the first segment is not a project with a built app (new `fallback` arg on
  `createPageServeHandler`) or is in `RESERVED_ROOT_SEGMENTS`. Serving no longer depends on an env var
  that can go missing.
- **Test that would have caught it:** `libs/cli/src/server/serve-app-mounts.test.ts` — boots the REAL
  `startSessionServer` and asserts, on BOTH mounts, that the shell is the app's (rebased `<base href>`,
  no root-absolute `/assets/`) and the app's own api route answers **JSON**; plus that the always-on
  root mount does not shadow the SPA. **Verified it FAILS pre-fix** (it gets the pod SPA shell) and
  passes post-fix. Nothing tested the route table before — every unit test of the page handler passed
  the whole time the bug was shipping.
- Updated the 4 `org/docs` pages that documented the env gate; `pnpm docs:check` → 4537 citations
  resolve. Deleted the now-fixed `.issues/` entry. Rebuilt `@lmthing/cli`, restarted the local server.

## Files added to context

- `sdk/org/scenarios/06-tanzania/scenario.md` — the spec + round-1 Actual results (which Acts exist/passed)
- `sdk/org/scenarios/06-tanzania/results/checkpoint.json` — per-Act resume state from round 1
- `.issues/served-app-renders-blank-asset-404.md` — the open high-severity bug (now fixed + deleted)
- `sdk/org/libs/cli/src/server/serve.ts` — the route table; where the env-gated root mount lived (the bug)
- `sdk/org/libs/cli/src/app/pages-serve.ts` — `createPageServeHandler`; added the `fallback` arg
- `sdk/org/libs/cli/src/server/router.ts` — to confirm match order + param semantics
- `sdk/org/libs/cli/src/server/routes/app-api.ts` — the app-api handler (404s when a project has no db)
- `sdk/org/libs/cli/src/server/serve-spaces.test.ts`, `libs/cli/src/app/build/pages.test.ts`,
  `libs/cli/src/app/api/loader.test.ts`, `libs/cli/src/app/boot.test.ts` — fixture shapes for the new test
- `org/docs/{README.md, app/routes.md, cli-api/README.md, format/project/project.json.md}` — the pages that
  documented the env gate
