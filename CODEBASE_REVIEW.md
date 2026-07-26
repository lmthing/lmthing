# Codebase review — full exploration, inconsistencies, and ideas

*Point-in-time review (2026-07-26) produced on branch `claude/codebase-exploration-docs-fhx11b`.
Six parallel deep-dives (core runtime, CLI/pod server, web+libs, cloud/devops, store/system-spaces/SPAs,
docs-integrity) with the highest-impact claims independently re-verified. Paths cite the monorepo;
`sdk/org/...` refers to the sdk submodule (github.com/lmthing/org). Line numbers are as of
monorepo `f443475` / sdk `e5d0aa3`. Confirmed bugs discovered here are also filed as `.issues/` entries;
once findings have been fixed or absorbed into `org/docs`, this file should be deleted per the
no-orphan-knowledge rule.*

---

## 1. What the product is

lmthing sells a **personal compute pod** fronted by **THING**, a single orchestrator agent. The
differentiator over a chatbot: the model does not call tools — it **writes TypeScript**, one statement
at a time, evaluated in a QuickJS WASM sandbox; value-yielding calls suspend the VM and are resolved
host-side. When you ask THING for something you want to *keep*, it doesn't just answer — it creates a
live project and builds a real application (SQLite tables + typed Node API + React pages served at
`/app/<project>/`), then hands ongoing operation to purpose-built specialist agents it can synthesize
on demand (via `system-architect`).

- **One runtime per user**: a single-tenant k8s pod (`user-<id>` namespace) running `lmthing serve` —
  one process serving the REST/WS API, the unified SPA, and every installed project-app.
- **One backend**: `cloud/` (Hono gateway `/api/*` + LiteLLM `/v1/*` → Azure). Auth = gateway-minted
  HS256 JWTs; Zitadel is identity-verification only. Tiers = LiteLLM budget windows + pod sizing.
- **Eleven system spaces** ship in the runtime: `user-thing` (orchestrator), `system-appbuilder`
  (automator, 18-step build DAG), `system-architect` (writes other agents), `system-engineer`
  (jailed scratch sandbox, returns code), `system-research`, `system-browser` (26 CDP functions),
  `system-files`, `system-vision`, `system-store` (fit-checks the catalog), `user-memory`,
  `system-global`.
- **Distribution**: `store/` is a browse-only static catalog — 6 machine-built project-app templates
  (health: 262 files/22 tables/27 pages; blog: 223 files; trips: 243 …) and 13 integration spaces.
  Install happens on the user's own pod (`POST /api/apps/install`, consent-gated `installSpace()`).
- **Surfaces**: one Vite SPA serves `/chat`, `/studio`, `/computer`, `/apps`, `/team` picked by
  hostname. `com` (marketing/billing) and `space` are genuinely built; `social`, `blog`, `casa` are
  scaffolds; `team/` (the SPA dir) was retired in favor of the unified surface.
- The capability system is the load-bearing safety idea: one `CapabilityProfile` drives **both**
  global injection and the typecheck DTS, so an ungranted call fails typecheck (retryable,
  model-visible), not runtime.

A notable buried asset: `automation/` has autonomously driven the five flagship store apps to
build-round 3–4 against `app-specifications/*.md` — "describe an app in a doc, come back to a working
app" is the product pitch, already running as an undocumented harness.

---

## 2. Overall health assessment

The architecture is coherent and unusually well-explained; the grounded-docs idea (`org/docs` +
`pnpm docs:check`) is genuinely good. But the review found the verification systems are weaker than
they claim, and that gap is where nearly every inconsistency lives:

1. **The docs gate certifies far less than it appears to.** It bounds-checks line anchors (drift
   invisible), skips ~1,855 bare-filename citations entirely, and is currently **red on main**
   (12–13 unresolvable citations) despite `SYNC.md`'s "hard zero" claim.
2. **CI runs almost no tests.** No workflow runs `pnpm test`, `turbo run typecheck`, the gateway's
   6 vitest suites, or `test:surface` (the named dark-mode gate). A live TS error ships in
   `apps/web` because it's the one package with no `typecheck` script.
3. **The gateway has real security gaps** (IDOR, unpinned JWT audience, cluster-wide secret RBAC,
   unthrottled signup) and a monetization inversion (free tier's LLM budget is 15× a paying Basic's).
4. **Refactors land ~95% complete.** The recent live-`createProject` refactor (PROGRESS.md) left
   orphaned specialist agents, dead `resolveCatalogRoot`, stale docstrings, and docs that assert
   the pre-refactor world — a pattern repeated by the Tailwind removal and the teams launch.

---

## 3. Inconsistencies

### 3a. Security (cloud gateway) — all verified in code

| # | Finding | Evidence |
|---|---|---|
| S1 | **IDOR**: `DELETE /api/keys/:token` deletes any LiteLLM key with no ownership check; every sibling route scopes by `user.id` | `cloud/gateway/src/routes/keys.ts:61-66` |
| S2 | **No audience pinning** on `verifyAccessToken` — `jwtVerify(token, secret)` with no `audience` option; the only thing keeping a 365-day pod token (`aud:"compute"`) from working as a user session is that its payload happens to lack `email` | `cloud/gateway/src/lib/tokens.ts:32-42` vs pinned `verifyBackupToken`/`verifyComputeToken`/`verifyInboundToken` |
| S3 | **Cluster-wide secret write** for the gateway ServiceAccount (get/list/create/update/patch/delete on `secrets`, ClusterRoleBinding = every namespace incl. `lmthing` where `GATEWAY_JWT_SECRET`, `STRIPE_SECRET_KEY`, `AZURE_API_KEY` live) though it only ever touches `user-env` in `user-*`/`team-*` | `devops/argocd/core/gateway.yaml:19-21,38-46`; `cloud/gateway/src/lib/compute.ts:550-604` |
| S4 | **No rate limiting** on `register`/`login`/`refresh`/`sso` (middleware exists, wired only to `/api/status`); register creates a Zitadel user + Stripe customer + a **$150/30d** LiteLLM key — unbounded signup = unbounded spend | `cloud/gateway/src/routes/auth.ts:62`; `routes/status.ts:25`; no Envoy rate limit in `devops/argocd/envoy/` |
| S5 | Invalid-token amplification: every failed local JWT verify triggers an outbound Zitadel introspection, unauthenticated and unthrottled | `cloud/gateway/src/middleware/auth.ts:38-48` |
| S6 | `GET /api/billing/checkout/status` returns any Stripe Checkout session by id (authed, not authorized) | `cloud/gateway/src/routes/billing.ts:205-216` |
| S7 | **Committed secret**: `cloud/gateway/.env.local.bak` is git-tracked and carries a real base64 `GATEWAY_JWT_SECRET` (`.gitignore` covers `*.local`, not `*.local.bak`) | `git ls-files` confirms |
| S8 | PII (email, GitHub login, full IDP intent response) `console.log`ged on every first OAuth login | `cloud/gateway/src/lib/zitadel.ts:189,223,259` |

Also: `trace.json` at the repo root leaks an author's absolute home path, a session UUID, and the
entire THING system prompt verbatim.

### 3b. Real functional bugs

| # | Finding | Evidence |
|---|---|---|
| B1 | **Free tier is the most generous tier**: free = $10/$50/$150 (1d/7d/30d) vs basic $1/$4/$10, pro $3/$10/$20, max $10/$30/$100. A paying Basic gets 15× less headroom than a free account | `cloud/gateway/src/lib/tiers.ts:91-98` vs `:118-155` (verified) |
| B2 | **Double URL-decoding** of project-app route params: the pod router decodes all params including the `rest` capture, then the app API loader decodes each segment again. An id containing `%2F` becomes a path separator → 404; literal `%` ids corrupt. LLM-built apps produce such slugs routinely | `sdk/org/libs/cli/src/server/router.ts:71` → `routes/app-api.ts:53` → `app/api/loader.ts:184` (verified) |
| B3 | **Shipping TS error**: `routes/computer/terminal.tsx` destructures `tier` from a context that has no such field (`undefined` at runtime, feeds `tier === 'pod'` and a `<BootProgress tier=…>` prop). Ships because `apps/web` is the only package with no `typecheck` script, so `turbo run typecheck` skips it | `sdk/org/apps/web/src/routes/computer/terminal.tsx:13,42,44`; `lib/runtime/ComputerContext.tsx:15-27`; `apps/web/package.json` |
| B4 | **Budget near-limit warning tells sessions to call a global they don't have**: `nearLimitWarning()` hardcodes "call `currentTask.resolve()` now", appended unconditionally — but the top-level session has no `currentTask` (fork/delegate-only), so an obedient model gets a guaranteed typecheck error at the moment it has the fewest retries left | `sdk/org/libs/core/src/eval/budget.ts:131`; `turn-loop.ts:916-917`; `bootstrap.ts:135-140` |
| B5 | **`registerSpace` DTS hole** — the one counterexample to "not granted ⇒ not injected AND absent from the DTS": declared unconditionally in `COMMON_DTS` but injection-gated, so a delegate calling it passes typecheck and throws at runtime | `sdk/org/libs/core/src/typecheck/library-dts.ts:43` vs `exec/bootstrap.ts:269` |
| B6 | **Seven appbuilder planning steps violate the "never forbid a tool in prose" rule**: `build_live_project/02,03,04,05,06,07,07a` declare `role: general` (writer globals injected) while prose says "no writers". Correct value is `role: plan` (step 01 does it right with `role: explore`). A plan node can silently write a half-formed table on the product's most expensive pipeline | `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/*.md` (verified: `03-plan_app.md:11` is `role: general`) |
| B7 | **Design-token violations that defeat the linter**: `var(--color-surface-hover/-active, rgba(...))` reference tokens that don't exist (real names: `hover`/`active`), so two studio lists always paint the achromatic fallback — with `ds-lint-ok` suppression comments. Separately, `chat/app/styles.css:24-32` redeclares `--font-sans`/`--font-display`/`--radius-*` on `:root` after `theme.css`, overriding the generated font stack globally (acknowledged in `sdk/org/.issues/`) | `sdk/org/libs/ui/src/studio/component-editor/component-list-item.tsx:28,30`; `functions/functions-editor/index.tsx:83,85`; `chat/app/styles.css:24-32` |
| B8 | **`@lmthing/ui` phantom dependency**: 108 imports of `@lmthing/state` across ~45 files, zero mention in `libs/ui/package.json` — resolves only via hoisting; already causes a documented double-React test failure | `sdk/org/libs/ui/src/hooks/fs/useFile.ts:1`; `elements/nav/app-sidebar/index.tsx:632-634` |
| B9 | **`integration-github` / `integration-google` have no `events/`** — the only action-only integrations. `system-store`'s finder fit-checks needs against `entry.events`, so every "when X happens in GitHub…" request is structurally unanswerable, even though the manifest generator ships a builtin GitHub webhook verifier | `store/spaces/integration-{github,google}`; `store/scripts/gen-apps-manifest.mjs:264-266` |

### 3c. The source of truth is drifting — and the gate can't see it

`org/docs` is the declared single source of truth with a "hard zero" citation gate. Found, with the
real resolver run against both the submodule pin and the sdk tip:

- **The gate is red on main**: 12 failures at the pin, 13 at sdk tip — deleted/moved files
  (`ide-editor.tsx` → `.web.tsx`, `terminal/index.tsx` → `.web.tsx`, deleted
  `button/index.css`, moved `SettingsSchemaForm.tsx`). `SYNC.md:124` ("hard zero") and
  `tools/docs-sync/README.md:57` ("no baseline today") are both currently false.
- **~1,855 bare-filename citations are invisible** to the gate (`citations.mjs` requires a
  `KNOWN_ROOTS` prefix), concentrated in the highest-traffic pages (turn-loop.md: 120,
  sessions.md: 109, commands.md: 101). That slice has rotted badly — the flagship "pipeline of one
  turn" block in `runtime/README.md:12-26` is wrong by ~140 lines on essentially every anchor.
- **Line anchors are only bounds-checked**, so in-range drift passes: dozens of verified examples in
  `serve.ts` (+44–68 lines), `bin.ts` (+~20), `session.ts`, `turn-loop.ts`, `app-admin.ts` — two doc
  pages even disagree with each other about the same handler and are both wrong.
- **Substantive doc-vs-code contradictions** (all verified):
  - The `LMTHING_GATEWAY_URL` root-mount gate was **removed** (its removal comment calls it a prod
    outage) but three doc pages still assert it — `cli-api/rest/README.md:47,122-123`,
    `rest/apps.md:189` (quotes a code line that no longer exists), `app/README.md:68` — while
    `app/routes.md` documents the correct behavior. Same directory, direct contradiction.
  - `fork-and-tasklists.md:193-206` documents the **pre-security-fix** `pickAllowed` behavior
    (omit `functions:` → ALL functions) that `fork.ts:322-339` deliberately reversed.
  - The yield-kind union in `turn-loop.md:204` and `runtime/README.md:70` lists `'tool'` (never
    existed) and omits `'buildApp'` (real, fully wired); `turn-loop.md:211` says "20 kinds", lists
    19, code has 19.
  - **`system-browser` is entirely undocumented**: code and tests say 11 system spaces; docs say
    "ten" in three places and the space appears in zero doc files — though THING can delegate to it.
  - **Teams**: `product-spas/README.md:9,59` grades `team` a "Scaffold" while the tip commit's
    handoff says "implemented, deployed, verified 42/42", `cloud/teams.md` + `rest/team.md` document
    it, and CI builds a `team` image. The `/team` surface has no `org/docs/team/` directory. The
    deleted `team/` SPA dir is still listed in `CLAUDE.md`'s repo tree and `product-spas/README.md`.
  - The **Tailwind removal** left the entire design-system doc narrative describing dead
    architecture: `@import "tailwindcss"` claims, a deleted `src/components/` stylesheet tree,
    nonexistent peer deps; Tamagui — the actual styling system — appears nowhere in `org/docs`.
    `libs/css/package.json` `exports` still maps `./elements/*`, `./components/*` to deleted dirs;
    `COMPONENTS.md` regenerates as garbage (lists `.css`, `.g`, `.md`, `.tsx` as "BEM classes").
  - `GET /api/health` — the load-bearing wake route — is missing from the "every HTTP route" table.
  - `spaces-loading.md` says ten system spaces (11); `organize_material` step filenames are cited
    one step behind disk; `--env-file` is a real CLI flag documented nowhere; scenarios 08/09/10
    exist but docs say "06 and 07 today".
- **`.issues` contract violations**: `.issues/research-store-noop-diagnosis.md` was deleted (per the
  lifecycle rule) but is still cited as the standing rationale in **11 source locations** and 4 doc
  passages. `.issues/pod-default-model-openai-not-azure.md` describes a bug verifiably fixed in
  `compute.ts:405-429`. Parts of `ci-deploy-flakiness.md` are fixed, parts (the dead ArgoCD sync URL
  targeting the nonexistent `applications/lmthing`) remain accurate.
- **Submodule pin drift fails forward**: docs are written against the pin; the sdk tip commit
  removed `DisplayBlock#renderNode`, so whoever bumps the pin inherits a red citation they didn't
  cause.

### 3d. Dead code and refactor leftovers

- `resolveCatalogRoot` + its 66-line test + `LM_STORE_APPS_DIR`: PROGRESS.md kept it because
  "routes/apps.ts uses it" — it doesn't (verified: no import; installs download from the store URL).
  `routes/apps.ts`'s module header still documents the removed local-catalog design its own body
  contradicts.
- Orphaned appbuilder specialists `data-modeler`/`page-builder`/`api-author`: ship in every image,
  unreachable (every `canDelegateTo` is `[]`), pinned by a test, claimed removed by
  `app-authoring.md:205` — yet **two live knowledge files still advertise them** to the architect
  and automator, sending models toward unreachable delegation targets.
- Vestigial multi-tier runtime plumbing: two disjoint `RuntimeTier` types (`'pod'` vs
  `'webcontainer'|'flyio'`), three hardcoded `"flyio"` literals, a permanently-false branch, and the
  dead 78-line `use-tier-detection.ts`. Plus dead `computer/login.tsx`, an unreachable dashboard
  with a fake uptime counter, and the inert `useRepoSync` (reads a localStorage key nothing writes).
- Dead public export `pendingYields` in `@lmthing/core` (permanently empty; everything uses
  `vm.pendingYields`).
- Dead config: Connections OAuth broker was dropped (migration 009) but `gateway.yaml:176-200`
  still injects its env and ansible still provisions it; `STRIPE_PRICE_STARTER` has no tier;
  digest-pin comments in two manifests contradict the populated values beside them;
  `pr-decline.yml` links contributors to an unrelated org's project.
- Stale in-code comments asserting old behavior: `setSessionMeta` "ends the turn" (it's
  fire-and-forget now), a spliced/orphaned comment fragment in `session.ts:1000-1005`,
  `static-apps.ts` docstring claiming bootstrap injection the code explicitly doesn't do.
- Root strays, all tracked, none referenced: `PROGRESS.md` (spent plan), `PROMPT_REVIEW.md`
  (9 audit findings not mirrored in `.issues`), `notes.txt`, `trace.json` (leaks, see 3a),
  `scratch/`, `gh-pages/`, `design/teams-handoff.md` (10 KB of trust-boundary knowledge outside
  `org/docs`, added by the same commit professing the no-orphan-knowledge rule).

### 3e. Process gaps

- **CI runs no tests**: workflows are build-images, design-tokens, docs-sync, native-target,
  pr-decline, stale. No `pnpm test` (~200 sdk test files), no `turbo run typecheck`, none of the
  gateway's 6 vitest suites (gateway type errors surface only at Docker build on main), and
  `test:surface` — named in-code as *the* gate for a previously-shipped dark-mode bug, with 20
  committed baselines — is never invoked.
- `pnpm docs:check` is unusable in a fresh clone (empty submodule → 4,172 indistinguishable
  failures; the `--sdk-org-root` escape hatch exists but isn't wired into the npm script).
- The store manifest is faithful to disk (verified file-by-file) but semantically misleading:
  `endpoints` counts only immediate `api/` subdirs (blog: 21 shown vs 54 real), `pages` lists
  `_app.tsx`/`_layout.tsx` as installable pages, and only `demo-feed` has a `project.json` — the
  five flagship apps list untitled, icon-less, with developer-facing descriptions.
- `app-specifications/*.md` directory-layout blocks are stale relative to their own later sections
  (trips shows 1 of 6 spaces; homes' third space appears in zero spec lines); no spec for demo-feed.

---

## 4. Ideas, prioritized

### Do first (small, high leverage, mostly hours each)

1. **Fix the gateway security quartet**: scope `DELETE /api/keys/:token` to the caller's keys; pin
   `audience` on `verifyAccessToken` (+ `.setAudience("user")` at signing); bind checkout-status to
   the caller's Stripe customer; apply the existing rate-limit middleware to
   register/login/refresh/sso. Rotate and purge the tracked `.env.local.bak`; delete `trace.json`.
2. **Reprice the free tier** (below basic) and add a one-line vitest invariant
   `free < basic ≤ pro ≤ max` so the inversion can't return; `resync-tier-budgets.ts` already
   exists to push it to live keys.
3. **Turn on CI**: PR jobs for `turbo run typecheck` (and add the missing `typecheck` script to
   `apps/web` — instantly catches the shipping `terminal.tsx` error), `pnpm test`, the gateway
   suite, and `test:surface`. This is the single biggest structural fix — three of the six
   deep-dives independently converged on it.
4. **One-line runtime fixes**: `role: plan` on the seven appbuilder planning steps; gate
   `registerSpace`'s DTS on the capability; make the budget wrap-up message capability-aware
   (render `currentTask.resolve()` only when `currentTask` is declared); declare `@lmthing/state`
   in `libs/ui`; fix the double-decode (decode named params once) + a `%2F`/`%2520` round-trip test.
5. **Give the five flagship apps a `project.json`** (title, icon, user-facing description — the
   generator already prefers it; `demo-feed` proves the path), count `endpoints` recursively, and
   filter `_app`/`_layout` from `pages`. Five small JSON files turn the storefront from a directory
   listing into a product page.

### Strengthen the verification systems (the theme of this review)

6. **Make `docs:check` verify content, not just bounds**: append a short content digest to line
   anchors (`path:483-484@a91c`, `docs:migrate --write` already owns the rewrite path) and fail on
   mismatch with a suggested re-anchor; teach the parser the docs' actual house style (per-document
   path cursor so bare-filename citations resolve); parse all segments of multi-range citations;
   add `.github`/`.issues` to known roots (and drop the fictional `team`). Land behind the
   sanctioned `--baseline` mechanism. Roughly doubles gate coverage and converts ~3,000 line
   citations from "in bounds" to "still true".
7. **Generate what is hand-transcribed today**: the REST route table from the `Router.add` registry,
   the yield-kind catalogue from the union/router/injector, the system-space table from
   `SYSTEM_SPACE_NAMES` — each diffed in CI. Every drift instance found in those tables was a
   hand-copy going stale.
8. **Lockstep capability test**: for each of the three capability profiles, assert the set of
   injected globals equals the set of DTS-declared names (modulo an explicit allowlist). Converts
   the runtime's central invariant from prose in five files into an enforced property; would have
   caught the `registerSpace` hole and prevents the next one.
9. **Machine-checkable `.issues`**: frontmatter (`status`, `attribution` as a real citation),
   resolve every `.issues/` reference in docs *and source* as part of the gate (11 dangling refs
   today), and a root-hygiene allowlist that forces `PROGRESS.md`/`notes.txt`/`trace.json`/
   `design/` to be deleted, ignored, or promoted into `org/docs`.
10. **Post-build artifact assertions for the CLI image**: a `verify-dist.mjs` asserting
    `dist/worker.js`, `dist/worker-load-entry.js`, `dist/cli/bin.js`, `dist/system-spaces/*` exist
    (the failure mode is "ships, boots, then every emitter/hook dispatch fails in prod"), plus one
    integration test that runs the built `bin.js` with `--mock` and exercises an app endpoint and
    an emitter scan.

### Product bets (the highest-value strategic ideas found)

11. **Ship GitHub/Google event sources.** The two most automation-worthy integrations are the only
    action-only ones, making every "when a PR opens…" request structurally unanswerable through the
    finder → `installSpace` → automator flow. GitHub is nearly free: the builtin webhook verifier
    already exists; `events/push|issue|pr.ts` copied from any sibling integration unlocks the whole
    class. Google needs cron-polling emitters — also an already-supported type.
12. **Promote `automation/` to a first-class product capability.** The app-builder harness
    autonomously grew five large apps from markdown specs — that *is* the pitch, running in an
    undocumented directory whose README disowns it. Document it, then expose a pod-side version:
    drop a spec into documents, THING runs the same round-robin expansion loop on a cron hook. The
    mechanism (`createProject` → automator retarget) already shipped and is live-verified.
13. **Resolve the stub-SPA strategy: cut or converge.** `blog/` is 6 stub files while
    `store/projects/blog` is a 223-file production app — the exact product the stub's IDEAS.md
    describes. Retire the `blog` and `casa` shells (precedent: `team/`), and point the domains at
    installed project-apps; keep `social` only if the roadmap funds it.
14. **Make the store's `/publish` real (UGC loop) or delete the stub routes.** A user's
    architect-synthesized specialist is *already* a valid store space — the format is identical.
    Wiring `/publish` to it creates a genuinely differentiated user-generated-content loop;
    `/category` is nearly free (manifest `tags[]` exist). Today three reachable routes render a
    bare `<h1>`.
15. **Un-orphan or delete the appbuilder slice specialists** — either grant the automator
    `canDelegateTo: [data-modeler, page-builder, api-author]` so its per-file `forEach` fans out to
    least-privilege agents (what the knowledge files already promise), or delete the three
    directories and fix the two knowledge files and the pinning test. Present-but-unreachable-but-
    advertised is the worst of the three states. Add a reachability lint over the `canDelegateTo`
    graph so the next refactor can't silently orphan an agent.
16. **Document what shipped**: `org/docs/team/` for the live `/team` surface,
    `system-browser` in the system-spaces docs, a Tamagui design-system page (the excellent 60-line
    header comment in `tamagui.config.ts` is the source material), and retire the dead
    Tailwind/BEM narrative + `COMPONENTS.md`.

---

## 5. Cross-cutting observation

Every serious finding traces to one root cause: **the repo's contracts are stronger than its
enforcement.** The contracts themselves are excellent — grounded docs, capability gating, issue
lifecycle, design tokens, "never forbid in prose". But the docs gate can't see drift, CI can't see
test failures, the `.issues` lifecycle is manual, and the capability invariant has no lockstep test.
Each refactor (live createProject, Tailwind removal, teams, fork-function security fix) was executed
well in code and left a trail of un-enforced contract violations behind it. Investing in items 6–10
(enforcement) is what makes items 1–5 stay fixed.
