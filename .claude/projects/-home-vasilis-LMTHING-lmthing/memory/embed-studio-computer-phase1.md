---
name: embed-studio-computer-phase1
description: Phase 1 of embedding studio/computer/chat into the CLI — apps relocated into the sdk/org submodule, served by Host header
metadata:
  type: project
---

Phase 1 of `.claude/plans/embed-studio-computer.md` is implemented + locally verified (2026-06-29).

- `/studio` and `/computer` were **moved out of the parent repo into the `sdk/org` submodule** at `sdk/org/packages/ui/apps/{studio,computer}`, plus a new `sdk/org/packages/ui/apps/chat` (`@lmthing/chat-app`, wraps agent-ui `mountApp`). So this change spans two git repos: parent records the deletions + `pnpm-workspace.yaml`/`sdk/libs/{auth,utils}` edits; the submodule holds the moved trees + `packages/cli/src/server/static-apps.ts` + `serve.ts`.
- The CLI (`lmthing serve`) now serves all three prebuilt apps by Host header via `static-apps.ts` (studio/computer/chat), injecting the bootstrap IIFE (`__LM_ACCESS_TOKEN__`/`__WS_URL__`/`__LM_PROJECT_MODE__`) into each `index.html`. All `/api/*` routes unchanged.
- Pod-injected auth: `@lmthing/auth` gained `getPodInjectedToken()`/`isPodEmbedded()`; `AuthProvider` adopts the injected token as a synthetic session; studio/computer `__root.tsx` `PodEnsureGate` short-circuits when `isPodEmbedded()`.

**Gotcha (non-obvious):** `sdk/org` is a submodule with its **own** `pnpm-workspace.yaml`, so naive "walk up to pnpm-workspace.yaml" repo-root detection stops there and doubles `sdk/org/...` paths. `findRepoRoot` in `sdk/libs/utils/src/vite.mjs` now also requires a `sdk/libs` dir to identify the true outer root. Likewise `static-apps.ts` `findAppsBase()` walks up to a dir containing `packages/ui/apps` because tsup flattens the cli build into `dist/` (source-relative depth is wrong at runtime).

Phase 2 (NOT done): compute Dockerfile build of the 3 apps, slim root studio/computer to bootstraps, Envoy `…-pod-root` routes, CI matrix, remove dangling `studio`/`computer` workspace entries.
