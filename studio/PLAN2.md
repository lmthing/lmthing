# PLAN2 — Remaining Work to Align `app/src` with `app/PLAN.md`

Status audit of `app/src` against the 7-phase plan in `app/PLAN.md`.
All hooks must use `lib/state` — the shared `@lmthing/state` package.

---

## Phase 1: CSS Element Layer — COMPLETE

All 24 CSS element files exist under `src/css/elements/`. No action needed.

## Phase 2: Element Components — COMPLETE

All 24 element components exist under `src/elements/` with matching `index.test.tsx` files. No action needed.

## Phase 3: FS State Layer Integration — MOSTLY COMPLETE

### 3a. Hooks that forward to `lib/state` — DONE

All `app/src/hooks/` files correctly import from `@lmthing/state` (38 hook files confirmed).

### 3b. Missing side-effect hooks

The plan specifies three side-effect-only hooks that are **not present** in `app/src/hooks/fs/`:

| Missing Hook | Purpose |
|---|---|
| `useFileWatch(path, cb)` | Side-effect-only file watcher (no state) |
| `useDirWatch(dir, cb)` | Side-effect-only dir watcher (no state) |
| `useGlobWatch(pattern, cb)` | Side-effect-only glob watcher (no state) |

**Action:** Create these three hooks in `app/src/hooks/fs/`, forwarding to their `lib/state` equivalents. Update `app/src/hooks/fs/index.ts` barrel export.

### 3c. Old state machinery not yet removed

The plan (Phase 3.4) requires deleting these files. They **still exist**:

| File | Status |
|---|---|
| `src/lib/workspaceDataContext.tsx` | Still exists — referenced by 16 files |
| `src/lib/workspaceContext.tsx` | Still exists |
| `src/lib/workspaces.ts` | Still exists |
| `src/hooks/useAgents.ts` | Exists — should re-export `useAssistantList()` only (currently still imports old context) |
| `src/hooks/useFlows.ts` | Exists — should re-export `useWorkflowList()` only (currently still imports old context) |
| `src/hooks/useKnowledge.ts` | Exists — should re-export `useKnowledgeFields()` only (currently still imports old context) |
| `src/hooks/usePackageJson.ts` | Exists — should re-export from `space/usePackageJson` only |
| `src/hooks/useWorkspaces.ts` | Exists — should re-export from `useStudio().spaces` (currently imports TanStack Query) |

**Action:**
1. Rewrite `useAgents.ts`, `useFlows.ts`, `useKnowledge.ts`, `useWorkspaces.ts`, `usePackageJson.ts` to be thin re-exports of their `lib/state`-backed composite hooks.
2. Delete `src/lib/workspaceDataContext.tsx`, `src/lib/workspaceContext.tsx`, `src/lib/workspaces.ts` once no component imports them (blocked by Phase 5 component migration and Phase 7 cleanup).

### 3d. TanStack Query still in provider tree

`app/src/app/layout.tsx` still includes TanStack Query provider. Per the plan, TanStack Query should remain **only** for GitHub auxiliary calls (stars, deployment status) — not for space data. Currently `useWorkspaces.ts` still uses it for space data.

**Action:** Remove `QueryClientProvider` from `layout.tsx` if GitHub auth components (`github-stars`, `github-deployment-status`) can fetch without it, or scope it narrowly to those components only.

---

## Phase 4: Domain Type Renames — COMPLETE

`src/types/space-data.ts` has all renames with deprecated aliases. No action needed.

---

## Phase 5: Feature Components — PARTIALLY COMPLETE

### 5a. Missing components

These components are specified in the plan's target directory structure but **do not exist**:

| Missing Component | Plan Location |
|---|---|
| `components/studio/studio-list/index.tsx` | Studio list view |
| `components/studio/studio-card/index.tsx` | Studio card item |
| `components/space/space-card/index.tsx` | Space card item |
| `components/assistant/assistant-card/index.tsx` | Assistant card item |
| `components/workflow/save-workflow-modal/index.tsx` | Save workflow dialog |
| `components/knowledge/field/field-card/index.tsx` | Knowledge field card |
| `components/knowledge/subject/subject-list/index.tsx` | Subject list within a field |
| `components/knowledge/subject/subject-item/index.tsx` | Subject list item |
| `components/knowledge/topic-detail/topic-editor/index.tsx` | Topic markdown editor |
| `components/thing/thing-message/index.tsx` | Individual thing/chat message |

**Action:** Create each component. All must:
- Use only CSS classes from `src/css/elements/` (no Tailwind in TSX)
- Read state via composite hooks from `app/src/hooks/` (which forward to `lib/state`)
- Include a co-located `index.test.tsx`

### 5b. Missing test files for existing components

**No** feature component under `src/components/` has a test file. The plan requires every component to have `index.test.tsx`.

**Action:** Create `index.test.tsx` for all 35 existing feature components.

### 5c. Components still using React Router

These 7 components import `useRouter`, `useParams`, or `useNavigate` from React Router instead of Next.js:

- `components/shell/studio-sidebar/index.tsx`
- `components/shell/studio-layout/index.tsx`
- `components/shell/studio-shell/index.tsx`
- `components/shell/spaces-layout/index.tsx`
- `components/shell/settings-view/index.tsx`
- `components/knowledge/topic-detail/topic-viewer/index.tsx`
- `components/assistant/builder/assistant-builder/index.tsx`

**Action:** Migrate these to Next.js `useParams` / `useRouter` from `next/navigation`.

### 5d. Old un-migrated component files

These old component files still exist alongside their migrated replacements:

- `src/components/GithubLoginButton.tsx` (migrated to `auth/github-login/`)
- `src/components/GithubDeploymentStatus.tsx` (migrated to `auth/github-deployment-status/`)
- `src/components/GithubStars.tsx` (migrated to `auth/github-stars/`)

**Action:** Delete these after confirming no imports reference them.

---

## Phase 6: Next.js App Router — MOSTLY COMPLETE

### 6a. Missing route

| Missing Route | Plan Path |
|---|---|
| `app/[username]/[studioId]/[spaceId]/workflow/new/page.tsx` | Create new workflow |

**Action:** Create this page, rendering the workflow editor in create mode.

### 6b. App router pages may need review

All other routes exist. Verify that each `layout.tsx` correctly mounts the FS context scope per the plan:

- `app/layout.tsx` — should mount `AppContext` + `GithubProvider`
- `[username]/layout.tsx` — should be a pass-through (UserFS not separately contexted yet)
- `[username]/[studioId]/layout.tsx` — should mount `StudioContext`
- `[username]/[studioId]/[spaceId]/layout.tsx` — should mount `SpaceContext` and render `StudioShell` + `StudioSidebar`

**Action:** Audit each layout to confirm context mounting matches the plan.

---

## Phase 7: Cleanup — NOT STARTED

### 7a. `src/shell/` directory — still exists (17 files)

The entire `src/shell/` directory remains with old components:

- `StudioLayout.tsx`, `LandingLayout.tsx`, `WorkspacesLayout.tsx`, `MarketplaceLayout.tsx`
- `components/CreateDomainModal.tsx`, `CreateAgentInline.tsx`, `KnowledgeTree.tsx`, `ThingPanel.tsx`, `StudioSidebar.tsx`, `WorkspaceSelector.tsx`, `ToolCallDisplay.tsx`, `SettingsView.tsx`, `CreateDomainInline.tsx`, `StudioShell.tsx`, etc.

All of these reference `WorkspaceDataContext` and old patterns. Their replacements exist under `src/components/`.

**Action:** Delete `src/shell/` entirely. Ensure no imports reference it.

### 7b. `src/components/ui/` directory — still exists (14 files)

Old Radix UI wrapper components still exist:

`skeleton.tsx`, `label.tsx`, `dropdown-menu.tsx`, `separator.tsx`, `button.tsx`, `tabs.tsx`, `input.tsx`, `dialog.tsx`, `avatar.tsx`, `sheet.tsx`, `badge.tsx`, `collapsible.tsx`, `table.tsx`, `card.tsx`

These are replaced by `src/elements/`.

**Action:** Delete `src/components/ui/` entirely. Update any remaining imports to use `src/elements/` equivalents.

### 7c. Old context files — still exist

- `src/lib/workspaceDataContext.tsx`
- `src/lib/workspaceContext.tsx`
- `src/lib/workspaces.ts`

**Action:** Delete after all consumers are migrated (depends on 7a completion).

### 7d. `src/lib/router.tsx` — already removed

No action needed.

### 7e. Vite config — already removed

`vite.config.ts` and `index.html` are gone. `next.config.ts` exists. No action needed.

---

## Summary: Ordered Task List

All items must use `lib/state` (`@lmthing/state`) for state access.

| # | Task | Phase | Blocked By |
|---|---|---|---|
| 1 | Create `useFileWatch`, `useDirWatch`, `useGlobWatch` in `app/src/hooks/fs/` (forward to `lib/state`) | 3b | — |
| 2 | Rewrite legacy compat hooks (`useAgents`, `useFlows`, `useKnowledge`, `useWorkspaces`, `usePackageJson`) to thin re-exports of `lib/state`-backed composites | 3c | — |
| 3 | Migrate 7 components from React Router to Next.js `next/navigation` | 5c | — |
| 4 | Create 10 missing feature components (with `index.test.tsx`, using `lib/state` hooks, CSS-only styling) | 5a | — |
| 5 | Create `index.test.tsx` for all 35 existing feature components | 5b | — |
| 6 | Create missing route `workflow/new/page.tsx` | 6a | — |
| 7 | Audit 4 layout files for correct context mounting | 6b | — |
| 8 | Delete `src/shell/` (17 files) | 7a | 3, 4 |
| 9 | Delete `src/components/ui/` (14 files) | 7b | 4 |
| 10 | Delete old component files (`GithubLoginButton.tsx`, `GithubDeploymentStatus.tsx`, `GithubStars.tsx`) | 5d | — |
| 11 | Delete `src/lib/workspaceDataContext.tsx`, `src/lib/workspaceContext.tsx`, `src/lib/workspaces.ts` | 7c | 2, 8 |
| 12 | Remove or scope down TanStack Query `QueryClientProvider` from `app/layout.tsx` | 3d | 2, 11 |

---

## Key Constraint

> Every hook and component that accesses state **must** go through `lib/state`
> (`@lmthing/state`). No direct `Map` access, no `WorkspaceDataContext`, no
> TanStack Query for space data. The path is:
>
> ```
> Component → app/src/hooks/useXxx → lib/state/hooks/useXxx → SpaceFS/StudioFS → AppFS
> ```
