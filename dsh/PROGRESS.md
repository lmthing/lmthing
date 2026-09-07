# dsh → production harness migration — progress

Tracks execution of the approved plan (`~/.claude/plans/i-want-to-fully-vivid-emerson.md`):
fully adopt dsh as the sole agent harness, retire `@lmthing/core`. Scope = agents/chat/orchestration
only; no system-space migration; `@lmthing/ui` is kept (decoupled from core) for future dsh
integration.

## Part A — harden & complete the dsh track (`dsh/`)

- [x] **A0 — pin dsh hard.**
  - Exact-pinned every `@deepseek-ai/*` peer/dev dependency across all 9 `dsh/packages/*` manifests
    (was `^0.1.1-rc.2` / `^4.0.1`, now exact `0.1.1-rc.2` / `4.0.1`). Root `dsh/package.json` was
    already exact-pinned.
  - Added `dsh/.npmrc` (`save-exact=true`) so future additions default to exact versions.
  - Verified `pnpm install --frozen-lockfile` is green after refreshing lockfile specifiers
    offline (`pnpm install --offline`, zero network resolution — proves no version actually moved,
    only the specifier string).
  - **Not done in A0** (deliberately deferred, needs its own decision — see below): the
    vendored-mirror / private-registry mechanism for `pnpm install --frozen-lockfile --offline`
    against a mirror the registry can't silently break. 198 `@deepseek-ai/*` packages, ~41MB in the
    local store — committing that as tarballs is a real repo-size tradeoff, not a mechanical step.
    **Needs a decision**: committed tarball dir vs. private registry vs. accept frozen-lockfile +
    committed lockfile as the safety net for now (registry availability risk only, not version-drift
    risk — a real gap, but a different one).
  - **Found, not fixed** (belongs to A1): `packages/space-knowledge/test/resolve.test.js`'s
    "a real LMThing frontmattered option (user-thing playbooks)" test fails — the real
    `sdk/org/libs/core/system-spaces/user-thing` agent now declares capability `self:author`,
    which isn't in dsh's `CAPABILITY_IDS` allow-list (`packages/space-format/src/capabilities.js`).
    Pre-existing drift, confirmed unrelated to the pinning change. Fix when unifying the parsers.

- [ ] **A1 — unify the three space-format parsers** into one `@lmthing/dsh-space-format`.
- [ ] **A2 — `dsh-agent-presets` roster** for per-agent capability isolation (spike-gated).
- [ ] **A3 — fix the `lmthing-web` profile** to boot natively (no `--patch` workaround).
- [ ] **A4 — real component UI rendering** (`@lmthing/dsh-client-space-components`, reusing
      `@lmthing/ui`'s `render-descriptor.tsx` catalog).
- [x] **A5 — explicitly NOT in scope.** No system-space migration.
- [ ] **A6 — assemble the production `lmthing` web profile.**

## Part B — serve the dsh web UI as lmthing.chat

- [ ] B1 — pod runs dsh instead of `lmthing serve`.
- [ ] B2 — auth handshake shell (cookie JWT mint).
- [ ] B3 — Envoy routes/policies for lmthing.chat → pod.
- [ ] B4 — image/deploy wiring + canary, then cutover.

## Part C — remove the custom harness & dead web apps

- [ ] Decouple `@lmthing/ui` from `@lmthing/core` (keep ui in full).
- [ ] Delete `libs/core`, `libs/cli`, `apps/web`, `apps/app-shell`, `scenarios` (+ desktop/mobile
      decision).
- [ ] Docs + CI gate updates (`org/docs`, `build-images.yml`, `design-tokens.yml`).

## Operational notes

- A pre-existing, unrelated `git stash@{0}` (`WIP on main: e87ea91a fix(app): bump sdk/org —
  __APP_BASE__ for root-mount app router`, touching `PROGRESS.md` (root), `cloud/gateway/src/lib/
  {compute,db,tiers}.ts`, `devops/argocd/core/gateway.yaml`) exists in the parent repo — **do not
  pop or drop it**; it is someone else's in-progress work, unrelated to this migration. Confirmed
  present and untouched as of this note.
