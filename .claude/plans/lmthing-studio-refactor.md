# Studio over the pod: make `@lmthing/state` a thin layer on the pod's PVC

## Context

When a user opens **lmthing.studio** and logs in, they should see their **compute pod's PVC** directly:
all of their **projects** (including the built-in `user` and `system`), and under each, its **spaces**.

Today the studio is local-first: `@lmthing/state` is an in-memory VFS persisted to **localStorage**, the
nav is built around **"studios"** (local groupings in `lmthing.json`), spaces can be `local`/`github`/
imported-`pod`, and URLs carry the email (`/$username/$studioId/$storageId/$spaceId/...`). Pod spaces are
reachable only via a side `/pod/` route that copies a space into localStorage and a bespoke `PodSaveSync`
streams edits back.

We are inverting this: **`@lmthing/state` becomes a thin layer directly over the pod's PVC** (the pod is
the source of truth, not localStorage), and the **"studio"** concept is renamed to **"project"**
*everywhere* (state lib + ui lib + studio app). `chat/` and `computer/` don't import the studio-named
state symbols, so they're unaffected beyond recompiling.

### Decisions (confirmed with user)
- **State lib is a thin pod-backed FS** — reads/writes go to the pod's PVC via its REST API; drop
  localStorage as the source of truth.
- **Rename `studio`→`project` everywhere** (state lib, ui lib, studio app).
- **URLs:** drop `$username` (from session) and `$storageId` (all pod); `$studioId`→`$projectId`.
- **Pod-only**, drill-down nav: projects list → a project's spaces → a space editor.
- **Login must work exactly like lmthing.chat.** Mirror chat's bootstrap (`chat/src/routes/__root.tsx`
  + `chat/src/routes/index.tsx`): `@lmthing/auth` SSO (shared cloud session — a user logged into
  lmthing.chat is logged into studio) → `AuthGate`/`LoginScreen` → `PinGate` → then
  **`POST {CLOUD_BASE_URL}/api/compute/ensure`** (Bearer JWT) to wake the user's pod *before* any pod
  API call. `CLOUD_BASE_URL` resolves identically to chat:
  `import.meta.env.VITE_CLOUD_URL ?? (DEV ? 'https://cloud.test' : 'https://lmthing.cloud')`. Unlike
  chat, studio does **not** full-route to the pod's served UI (studio *is* the UI) — it keeps the JWT
  and calls the pod API directly with `Authorization: Bearer`. Chat's `RepoSyncGate` is intentionally
  **omitted** (that's GitHub workspace sync, not login — removed per the next bullet).
- **Remove local & GitHub *entirely*.** GitHub is only used here for **workspace persistence**
  (`githubRepo`, `useRepoSync`, studio's `GithubContext`/`workspaceLoader`) and **local demo spaces** —
  all of that is deleted (obsolete under pod-as-truth). SSO login + `PinGate` are unaffected.
- **Update the studio landing page** to the new model: the post-login home becomes the Projects list;
  the old `LandingLayout` (demo `local/` space marketplace, "My Studios"/"Open Studio" modal) is removed.

### Pod REST API (already implemented in `sdk/org/packages/cli/src/server/serve.ts`)
- `GET /api/projects` → `{ projects }`; `POST /api/projects {name}`; `DELETE /api/projects/:id`
- `GET /api/projects/:id/spaces` → `{ spaces: SpaceMeta[] }`
- `GET /api/projects/:id/spaces/:spaceId/files` → `{ files }` (whole space)
- `PUT /api/projects/:id/spaces/:spaceId/files {files}` (wipe-and-rewrite, whole space)

File I/O is **whole-space granularity**; there is no per-file or FS-watch channel (`/api/ws` is
session-scoped). So the thin layer hydrates a space's file map on entry and coalesces writes back.

## Target architecture — pod-backed `@lmthing/state`

Keep the public surface stable so the blast radius stays in the lib: `FSInterface`, `FSEventBus`,
`ScopedFS`, and the `useFile`/`useDir`/`useGlob` hooks are unchanged. Only the **backing store** changes —
the in-memory `Map` in `AppFS` (`sdk/libs/state/src/lib/fs/AppFS.ts`) becomes a write-through **cache**:

1. **`PodTransport`** — new `sdk/libs/state/src/lib/pod/transport.ts`. Thin wrapper over the pod REST API:
   `listProjects()`, `createProject(name)`, `deleteProject(id)`, `listSpaces(projectId)`,
   `loadSpaceFiles(projectId, spaceId): FileTree`, `saveSpaceFiles(projectId, spaceId, files)`.
   Constructed with `{ baseUrl, getAccessToken }`. (This is `studio/src/lib/pod/podSpaces.ts` relocated +
   generalized, incl. `isRunnableSpaceFile`; the studio copy is deleted.)

2. **`AppProvider`** (`lib/contexts/AppContext.tsx`) — receives pod config via props
   `{ podBaseUrl, getAccessToken }`, builds the `PodTransport`. **Remove** all localStorage load/save
   (`APP_STORAGE_KEY`, `STUDIO_STORAGE_PREFIX`, `saveAppData`), the `studios` list, and `lmthing.json`
   registry logic. Expose `projects`, `refreshProjects()`, `createProject`, `deleteProject` (from the
   transport). Keep `appFS`, `drafts`, `ui` (drafts/UI remain ephemeral in-memory).

3. **`ProjectProvider`** (rename of `StudioContext.tsx` → `ProjectContext.tsx`) — takes `projectId`;
   fetches `listSpaces(projectId)` → exposes `{ projectId, projectFS, spaces, currentSpaceId, … }`.
   `projectFS` prefix = `projectId` (no username). Space metadata comes from the pod, not `lmthing.json`.

4. **`SpaceProvider`** (`SpaceContext.tsx`) — takes `spaceId` (+ `projectId` from `ProjectProvider`).
   On mount, if `${projectId}/${spaceId}` isn't cached, `loadSpaceFiles` → write into `AppFS` under that
   prefix. Subscribe to `appFS.onPrefix(`${projectId}/${spaceId}`)` → debounced (≈1500ms)
   `saveSpaceFiles(projectId, spaceId, filtered)`. This **absorbs** studio's old `openSpace` hydrate and
   `PodSaveSync`. `spaceFS` prefix = `${projectId}/${spaceId}`.

5. **`ScopedFS`** (`lib/fs/ScopedFS.ts`): `StudioFS`→`ProjectFS(root, projectId)`,
   `SpaceFS(root, projectId, spaceId)`, `fromStudioFS`→`fromProjectFS`. Drop the username segment.

6. **Types/hooks rename**: `types/studio.ts`→`types/project.ts`
   (`StudioConfig`→`ProjectConfig` etc.; `AppData.studios`→`projects`); `hooks/studio/*`→`hooks/project/*`
   (`useStudio`→`useProject`, `useStudioConfig`→`useProjectConfig`, `useStudioEnv`→`useProjectEnv`,
   `useStudioFS`→`useProjectFS`); add `useProjects()` (list) and `useProjectSpaces()`. Update
   `lib/fs/paths.ts`, all `index.ts` barrels, `src/index.ts`, `test-utils.tsx`, and `*.test.tsx`.

**Layering:** `@lmthing/state` must not import `@lmthing/auth`. The studio app injects
`getAccessToken={() => session?.accessToken}` and `podBaseUrl={COMPUTER_BASE_URL}` into `AppProvider`;
the transport calls `getAccessToken()` per request (handles token refresh).

**Liveness:** load-on-enter + a manual refresh and refetch-on-window-focus for projects/spaces.
(Live FS push from the pod is out of scope — no such endpoint exists today; note as a future
enhancement once the pod exposes an FS-watch channel.)

## Workstream A — `@lmthing/state` (do first; ui/studio depend on it)
Implement the pod-backed architecture above: add `PodTransport`; rewire `AppContext`/`ProjectContext`/
`SpaceContext` for hydrate-on-enter + debounced write-back; rename `studio`→`project` across contexts,
`ScopedFS`, types, hooks, barrels; delete localStorage persistence and the studios/`lmthing.json`
registry path. Add/keep tests: transport (mock `fetch`), SpaceProvider hydrate+save-back, rename of
existing `useStudio`/scoped-FS tests.

## Workstream B — `@lmthing/ui` (rename + simplify to consume new hooks)
- `components/shell/studios-layout`→**`projects-layout`** (`ProjectsLayout`): list from `useProjects()`;
  open → navigate to `/$projectId`. Add create/delete project (optional) via `useApp()`.
- `components/shell/spaces-layout` (`SpacesLayout`): list from `useProject().spaces`; open → navigate to
  `/$projectId/$spaceId` (SpaceProvider hydrates). **Remove** the "New local space" creator and **all
  GitHub connect/disconnect UI** (the `useGithub` footer button). Keep search.
- `components/shell/studio-sidebar`: **remove** the GitHub connect/repo UI (11 refs); rename to the
  project hooks. `components/space/space-selector`: drop GitHub branches.
- Update `components/shell/{studio-layout,studio-shell}`, `settings-view`, `thing-panel`,
  `agent/builder/agent-builder`, and `hooks/studio/*`→`hooks/project/*` to the renamed hooks.
- **Delete** `components/auth/system-studio-bootstrap` (local demo seeding — obsolete under pod-as-truth).
- Leave the shared `components/auth/github-{login,stars,deployment-status}` widgets in the lib (not
  studio-owned), but stop referencing them from studio surfaces. `@lmthing/auth` session fields
  `githubRepo`/`githubUsername` may stay (harmless); `useRepoSync` stops being mounted by studio.

## Workstream C — `studio/` app
- **`__root.tsx`** — match chat's login chain, then provide pod config:
  `AuthProvider appName="studio"` → `AuthGate`/`LoginScreen` → `PinGate` → **`PodEnsureGate`** (new) →
  `AppProvider`. `PodEnsureGate` replicates chat's `ensurePod`: on an authenticated session, `POST
  {CLOUD_BASE_URL}/api/compute/ensure` with `Authorization: Bearer <accessToken>`, render a
  "Starting compute pod…" state + Retry on failure (copy `chat/src/routes/index.tsx` semantics), and
  only render children once ensure resolves. Then `AppProvider` gets
  `podBaseUrl={COMPUTER_BASE_URL}`, `getAccessToken={() => session?.accessToken}`. **Remove**
  `SystemStudioBootstrap`, `GithubProvider`, and `RepoSyncGate`/`useRepoSync` entirely.
- **Routes** (TanStack file-based — moving files regenerates `routeTree.gen.ts`; don't hand-edit):
  collapse `routes/$username/$studioId/$storageId/$spaceId/**` → `routes/$projectId/$spaceId/**`, lift out
  `$username`.
  - `routes/index.tsx` → **`ProjectsLayout`** — this is the new post-login landing (projects list,
    live from `GET /api/projects`). Replaces the old marketing/demo landing.
  - `routes/$projectId/route.tsx` → `ProjectProvider` (projectId from params).
  - `routes/$projectId/index.tsx` → `SpacesLayout`.
  - `routes/$projectId/$spaceId/route.tsx` → `SpaceProvider` (no more `PodSaveSync`/storageId logic).
  - Move all `agent/**`, `workflow/**`, `knowledge/**`, `settings/**`, `raw/` leaves up under
    `$projectId/$spaceId/`; in each, replace `username/studioId/storageId` param reads with `projectId`
    (+`spaceId`); username (if still needed) from `useAuth()`.
  - Delete `$username/{route,index}.tsx`, `$username/$studioId/pod/index.tsx`; move
    `$username/thing/index.tsx`→`routes/thing/index.tsx`.
- **`lib/space-url.ts`**: collapse to `/$projectId/$spaceId/...`; `buildSpacePath(projectId, spaceId)`;
  drop `storageId`/`buildFullSpaceId`/`parseSpaceId`. Update callers (`knowledge/*`).
- **Remove local/GitHub entirely (the core of this ask):**
  - Delete `studio/src/lib/github/` (`GithubContext.tsx`, `workspaceLoader.ts`),
    `studio/src/lib/pod/podSpaces.ts` (moved into state lib), `studio/src/shell/LandingLayout.tsx`,
    `studio/src/shell/MarketplaceLayout.tsx` + the `routes/marketplace/` route (demo/local marketplace),
    `studio/src/lib/demoToFileTree.ts`, and the local/GitHub paths in
    `studio/src/lib/workspaceExport.ts` and `studio/src/data/env-example.ts`.
  - Remove all remaining `github_token`/`octokit`/repo-sync references and local space creation
    (`createSpace('local/…')`, `toLocalSpaceId`).
- `lib/contexts/StudioContext.tsx` re-export → `ProjectContext`.

## Workstream D — recompile + clean up
Regenerate `routeTree.gen.ts` (router plugin, on `pnpm dev`/build). Monorepo typecheck so `chat`/`computer`
compile against renamed `@lmthing/state`/`@lmthing/ui` (sanity — they don't use the renamed symbols).
Run `@lmthing/state` tests.

## Critical files
- State lib: `sdk/libs/state/src/lib/pod/transport.ts` (new),
  `lib/contexts/{AppContext,StudioContext→ProjectContext,SpaceContext}.tsx`, `lib/fs/ScopedFS.ts`,
  `lib/fs/AppFS.ts` (cache role), `types/studio.ts→project.ts`, `hooks/studio/*→project/*`, `src/index.ts`.
- UI lib: `sdk/libs/ui/src/components/shell/{studios-layout→projects-layout,spaces-layout,studio-layout,
  studio-sidebar,studio-shell,settings-view}`, `components/thing/thing-panel`,
  `components/agent/builder/agent-builder`, `components/auth/system-studio-bootstrap` (delete),
  `hooks/studio/*`.
- Studio app: `studio/src/routes/**` (restructure), `studio/src/routes/__root.tsx`,
  `studio/src/lib/space-url.ts`, delete `studio/src/lib/pod/podSpaces.ts`,
  `studio/src/shell/{MarketplaceLayout,LandingLayout}.tsx`, `studio/src/lib/contexts/StudioContext.tsx`.

> Suggested execution: state lib first (it's the dependency), then ui lib + studio app in parallel,
> partitioned by directory (per the "fan-out Sonnet by directory" preference).

## Verification
1. Run the local stack so the pod/`computer.test` API is reachable (`.claude/skills/local-dev.md`); then
   `cd studio && pnpm dev`. Sign in via SSO and confirm parity with chat: `LoginScreen`→`PinGate`→a
   "Starting compute pod…" state while `POST cloud.test/api/compute/ensure` fires (network tab), then
   the app. A session already established on lmthing.chat should carry into studio without re-login.
2. `/` (the new landing) lists all pod projects incl. `user` and `system` (live from `GET /api/projects`);
   URL has no email; no demo/local marketplace or "My Studios"/GitHub-connect UI anywhere.
3. Open `user` → `/user/` lists that project's spaces (`GET /api/projects/user/spaces`); repeat for `system`.
4. Open a space → `/user/{spaceId}`; SpaceProvider hydrates files from
   `GET /api/projects/user/spaces/{spaceId}/files` (verify network tab) and the editor renders.
5. Edit a file → after the debounce, a `PUT …/spaces/{spaceId}/files` fires to the correct project; reload
   the page and confirm the edit persisted on the pod (no localStorage involved).
6. Confirm localStorage no longer holds space files (`lmthing-app`/`lmthing-studio:*` keys gone).
7. Monorepo typecheck passes incl. `chat`/`computer`; `pnpm --filter @lmthing/state test` passes.
8. Old routes (`/$username/...`, `/pod/`) no longer exist.


# Reconcider implementation decisions

## 2026-06-24 — types/project.ts: `AppData` type mismatch with `PodTransport` [RESOLVED]
`AppContext` now exposes `ProjectSummary[]` directly from the transport — `AppData` is not used for projects. The previous concern is no longer valid.

## 2026-06-24 — paths.ts: `lmthing.json`-based globs retained but plan removes registry [RESOLVED]
`AppContext` no longer uses the registry path; the globs remain in `paths.ts` for within-project reads but are no longer wired into the app bootstrap. Resolved.

## 2026-06-24 — BREAKING: `hooks/index.ts` still exports `./studio` after studio hooks deleted [RESOLVED]
Fixed: `hooks/index.ts` now exports `./project`.

## 2026-06-24 — BREAKING: test files still import deleted `StudioProvider`/`StudioFS`/`UserFS` [RESOLVED]
All three files updated: `test-utils.tsx` → `ProjectProvider`/`MockPodTransport`, `ScopedFS.test.ts` → `ProjectFS`/`fromProjectFS`, `useDraft.test.tsx` → `createTestWrapper`.

## 2026-06-24 — BREAKING: `test-utils.tsx` passes `transport` prop that `AppProvider` doesn't accept [RESOLVED]
`AppProvider` now accepts an optional `transport?: PodTransport` prop used as a testing seam; `pod` is no longer required when it is provided.

## 2026-06-24 — BUG: `useProjectConfig` reads via `useFile` (SpaceFS scope) instead of ProjectFS
`hooks/project/useProjectConfig.ts` calls `useFile('lmthing.json')`, but `useFile` reads from `SpaceFS` (prefix `projectId/spaceId`). `lmthing.json` lives at the project level (`projectId/lmthing.json`), not inside any space. So `useProjectConfig` always returns `null`. It should read directly from `projectFS.readFile('lmthing.json')` and subscribe via `projectFS.onFile(...)` using `useSyncExternalStore`, not via `useFile`.
**File:** `sdk/libs/state/src/hooks/project/useProjectConfig.ts`

## 2026-06-24 — PERF: `__root.tsx` recreates `PodTransport` on every render
`RootComponent` passes `pod={{ podBaseUrl: COMPUTER_BASE_URL, getAccessToken: () => session?.accessToken }}` as an inline object literal. `AppProvider` memoises the transport on `[pod.podBaseUrl, pod.getAccessToken]`, but `pod.getAccessToken` is a new function reference every render, so a new `PodTransport` is constructed every render. No infinite-loop risk (transport is stateless, `refreshProjects` uses a ref), but it is wasteful. Fix: wrap `getAccessToken` in `useCallback(() => session?.accessToken, [session])` in `RootComponent`.
**File:** `studio/src/routes/__root.tsx`

## 2026-06-24 — BUILD BREAK (known/transitional): `routes/index.tsx` imports non-existent `ProjectsLayout`
`routes/index.tsx` imports `{ ProjectsLayout }` from `@lmthing/ui/components/shell/projects-layout`, but `studios-layout` was just deleted and `projects-layout` has not been created yet (Workstream B). The comment in the file acknowledges this. Studio will not compile until Workstream B adds `ProjectsLayout`.
**File:** `studio/src/routes/index.tsx`

## 2026-06-24 — Workstream B (`@lmthing/ui`) complete [DONE]
- `studios-layout` → `projects-layout` (`ProjectsLayout`); `spaces-layout` simplified (no local/GitHub UI); `studio-sidebar` GitHub UI removed.
- Added `sdk/libs/ui/src/lib/space-path.ts` (`buildProjectPath`/`buildSpacePath`) to decouple shell components from the studio app's `@/lib/space-url` (the old `@/` alias pointed into `studio/src/*`). Shell components now route off `$projectId`/`$spaceId` params only.
- `hooks/studio/*` → `hooks/project/*` (re-export renamed state hooks); `hooks/fs/useStudioFS` → `useProjectFS`; deleted `components/auth/system-studio-bootstrap.tsx`.
- `thing-panel`/`agent-builder`/`settings-view`/`studio-layout`/`studio-shell` switched to project hooks + local space-path; legacy `useWorkspaces`/`studio-list` repointed at `projects`.
- NOTE for studio agent: `ProjectsLayout`/`SpacesLayout` accept optional `onOpenProject`/`onOpenSpace`/`onGoHome` overrides; defaults navigate to `/$projectId` and `/$projectId/$spaceId`. The shared `github-login`/`github-stars`/`github-deployment-status` widgets stay (still import `@/lib/github/GithubContext` — studio-owned).
- Typecheck: `@lmthing/ui` has 701 pre-existing errors (element-prop `children` typing + missing `vitest`/`@tanstack/react-router` modules) — **unchanged from the 726-error baseline on `main`**; Workstream B introduced zero new errors and fixed 2 rename-induced ones.
