# ci: no workflow runs tests or typecheck — a live TS error ships in apps/web

**Symptom:** `.github/workflows/` contains build-images, design-tokens, docs-sync, native-target,
pr-decline, stale — nothing runs `pnpm test` (~200 sdk test files), `turbo run typecheck`, the
gateway's 6 vitest suites (gateway type errors surface only via `npx tsc` inside the Dockerfile at
image build on main), or `pnpm test:surface` (named in `sdk/org/libs/ui/src/theme/tamagui.config.ts:36-40`
as THE gate against a previously-shipped dark-mode bug; its 20 committed baselines are never
compared). Concrete consequence already shipped: `apps/web` is the only workspace package with no
`typecheck` script, so `sdk/org/apps/web/src/routes/computer/terminal.tsx:13` destructures `tier`
from a context that has no such field (`ComputerContext.tsx:15-27`) — a plain TS error running on
`undefined` in production.

**Direction:** add a PR workflow running `turbo run typecheck` + `pnpm test` (sdk), the
`@lmthing/gateway` build+test, and `test:surface`; add the missing `typecheck` script to
`apps/web/package.json` and fix the `terminal.tsx` error it surfaces.

**Where:** `.github/workflows/`; `sdk/org/apps/web/package.json`;
`sdk/org/apps/web/src/routes/computer/terminal.tsx:13,42,44`.
