# Studio views & components

What each pane of the `/studio` surface actually renders, and which file implements it. Route → URL mapping lives in [./routes.md](./routes.md); this page is the component inventory behind those routes.

Two source trees are involved:

- **`sdk/org/apps/web/src/routes/studio/**`** — the route components (thin: most delegate straight to the ui lib) `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/functions/index.tsx:4-6`
- **`sdk/org/libs/ui/src/studio/**`** — the actual editors/shell, exported from the `@lmthing/ui/studio` barrel `sdk/org/libs/ui/src/studio/index.ts:1-10`

---

## The persistence model (why no editor has a "save to server" button)

Every space editor writes to the in-memory VFS (`spaceFS.writeFile(...)`), never to an endpoint. `SpaceProvider` hydrates the whole space file map on mount and writes it back with a **1500 ms-debounced** whole-space PUT `sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:35` `sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:92` `sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:124-158`. So the "Save" buttons you see in the editors below commit a draft into the VFS; the network round-trip is the provider's job. See [../cli-api/rest/projects.md](../cli-api/rest/projects.md) for the `GET|PUT /api/projects/:id/spaces/:spaceId/files` contract those calls hit.

The project-app tabs (`/studio/$projectId/app/*`) are the exception — they talk to the pod management API directly (see [App admin tabs](#app-admin-tabs-studioprojectidapp) below).

---

## Shell

### `StudioShell`
`sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:57-148`

The three/four-column frame for every space route:

| Column | Component | Notes |
|---|---|---|
| Outer sidebar | `<StudioAppSidebar/>` | projects + spaces `…/studio-shell/index.tsx:94` |
| Inner rail | `<StudioSidebar asRail/>` | the open space's contents `…/studio-shell/index.tsx:97-108` |
| Primary pane | `children` — or `<SettingsView/>` when the path contains `/settings` | `…/studio-shell/index.tsx:110-127` |
| Right dock | `rightPanel` (the THING chat), 400px, only when toggled on | `…/studio-shell/index.tsx:129-145` |

With no children it renders an empty state counting knowledge fields / agents / tasklists `sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:114-125`.

Two persisted toggles: `studio-shell.sidebar.collapsed` and `studio-shell.thing.open` (default **false** — the dock is opt-in, not always-on) `sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:70-72`.

### `StudioLayout`
`sdk/org/libs/ui/src/studio/shell/studio-layout/index.tsx:38-109`

The binding of `StudioShell` used by the space layout route. It owns three behaviours:

- redirects a bare `…/settings` to `…/settings/env` `…/studio-layout/index.tsx:54-58`
- **create agent** — `window.prompt` for a name, then writes `agents/agent-<slug>/instruct.md` via `serializeAgentInstruct` and navigates to the new agent `…/studio-layout/index.tsx:60-76`
- **create knowledge domain** — writes `knowledge/<slug>/<slug>/index.md` with `type`/`variable` frontmatter and navigates to the encoded field id `<domain>---<field>` `…/studio-layout/index.tsx:78-91`

### `StudioAppSidebar`
`sdk/org/libs/ui/src/studio/shell/studio-app-sidebar/index.tsx:27-73`

Feeds `useProjects()` / `useProject()` into the shared `AppSidebar` element: project dropdown (create/delete), the collapsible SPACES list, a gear that routes to project settings, and `<SidebarFooter current="studio"/>` `…/studio-app-sidebar/index.tsx:33-71`. Selecting a project navigates to `/studio/$projectId`; selecting a space to `/studio/$projectId/$spaceId` `…/studio-app-sidebar/index.tsx:49,66-68`.

### `StudioSidebar` (the inner space rail)
`sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:70-380`

Five collapsible sections, each with a live count and a create/edit affordance:

| Section | Source of items | Link target |
|---|---|---|
| Knowledge (n) | `useKnowledgeFieldList()` | `…/knowledge/<fieldId>` `…/studio-sidebar/index.tsx:165-191` |
| Agents (n) | `useAgentList()` | `…/agent/<id>` `…/studio-sidebar/index.tsx:193-219` |
| Tasklists (n) | `useTasklistList()` | `…/workflow/<name>` `…/studio-sidebar/index.tsx:221-247` |
| Functions (n) | `useGlob('functions/*.ts')` | `…/functions` `…/studio-sidebar/index.tsx:249-274` |
| Components (n) | `useGlob('components/{view,form}/*.tsx')`, badged `view`/`form` | `…/components` `…/studio-sidebar/index.tsx:276-299` |

Footer: THING toggle (or a link to `/studio/thing` when no dock is wired), **Raw Files**, cross-app links, Settings, Collapse `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:330-376`.

> Gaps in this component: a **Conversations** section renders only when an agent is active and is hard-coded to `Conversations (0)` / "No conversations yet." `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:301-316`. The **Create Tasklist** button is wired to `onCreateAgent` `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:241` — clicking it creates an agent.

### `StudioProjectView`
`sdk/org/libs/ui/src/studio/shell/studio-project-view/index.tsx:15-37` — the `/studio/$projectId` landing: sidebar plus "Select a space to begin" with the space count.

---

## Space editors

### `AgentBuilder`
`sdk/org/libs/ui/src/studio/agent/builder/agent-builder/index.tsx:16-83`, state in `…/use-agent-form.ts:24-212`

Edits **`agents/<slug>/instruct.md` only** `sdk/org/libs/ui/src/studio/agent/builder/agent-builder/index.tsx:1-4`. Panels, top to bottom:

- `AgentHeader` — title input, unsaved/valid indicators, Save, Back `…/agent-builder/index.tsx:21-29`
- `SystemPromptPanel` — the instruct **body** `…/agent-builder/index.tsx:36`
- `ActionsSection` — `actions[]` rows, each bindable to a tasklist name discovered from the VFS `…/agent-builder/index.tsx:38-44`
- `DefaultActionPanel` — only shown once actions exist `…/agent-builder/index.tsx:46-52`
- three `MultiSelectField`s — **Knowledge**, **Functions**, **Components**, each populated from the space itself `…/agent-builder/index.tsx:54-73`
- `CanDelegateToField` — the delegation allowlist `…/agent-builder/index.tsx:75`

The pickers are derived by globbing the space: function names from `functions/*.ts`, component names from `components/{view,form}/*.tsx`, and knowledge refs at **both** granularities — field-level `domain/field` (from `knowledge/*/*/index.md`) and option-level `domain/field/slug` `sdk/org/libs/ui/src/studio/agent/builder/agent-builder/use-agent-form.ts:48-89`. Saving serializes the draft back through `serializeAgentInstruct` to `P.instruct(id)` `…/use-agent-form.ts:144-161`.

Field semantics (what each of these means to the runtime) → [../format/space/agents/README.md](../format/space/agents/README.md).

`AgentCard` (used by the agent list route) renders the instruct title plus an action count `sdk/org/libs/ui/src/studio/agent/agent-card/index.tsx:12-27`.

### `FunctionsEditor`
`sdk/org/libs/ui/src/studio/functions/functions-editor/index.tsx:234-356`

Left: the `functions/<name>.ts` list with rename (inline input) and delete; right: a raw-TypeScript `<textarea>` pane with an explicit Save and a **Cmd/Ctrl-S** shortcut `…/functions-editor/index.tsx:150-217`. Creating a function seeds a default template `…/functions-editor/index.tsx:22-28`; renaming is copy-then-delete `…/functions-editor/index.tsx:276-285`.

It flags host-enforced consent: a leading `@consent` pragma in the source renders a `consent` badge on the list item, using a browser-safe mirror of core's `functionRequiresConsent` (core's version pulls in `node:crypto`, so it can't be imported into the web bundle) `sdk/org/libs/ui/src/studio/functions/functions-editor/index.tsx:34-61,113-118`. Format → [../format/space/functions/README.md](../format/space/functions/README.md).

### `ComponentEditor`
`sdk/org/libs/ui/src/studio/component-editor/index.tsx:41-175`

Two lists in one pane — **View** (`components/view/<Name>.tsx`, badged `display()`) and **Form** (`components/form/<Name>.tsx`, badged `ask()`) `…/component-editor/index.tsx:111-163` — plus a create form whose `Select` chooses the kind `…/component-editor/index.tsx:93-100`, and a shared `ComponentCodeEditor` pane. Format → [../format/space/components/README.md](../format/space/components/README.md).

### `TasklistEditor`
`sdk/org/libs/ui/src/studio/workflow/workflow-editor/index.tsx:18-114`

A **form-based** (not graph-based) editor for one tasklist. Two parts:

- `ManifestSection` — the tasklist-level `index.md`: description + input schema rows `sdk/org/libs/ui/src/studio/workflow/workflow-editor/manifest-section.tsx:17-40`
- one `TaskForm` card per task, with move-up/move-down/delete `…/workflow-editor/index.tsx:86-103`

A task draft carries exactly `id, instruction, input[], output[], dependsOn[], goal, optional, condition` `sdk/org/libs/ui/src/studio/workflow/workflow-editor/types.ts:14-24`; schema rows are `{field, type}` over `string|number|boolean|object|array` `…/types.ts:5-11`. The hook reads/writes `tasklists/<name>/NN-<id>.md` and `tasklists/<name>/index.md` through SpaceFS `sdk/org/libs/ui/src/studio/workflow/workflow-editor/useTasklistEditor.ts:1-24`. `WorkflowEditor` is kept as an alias of the same component `…/workflow-editor/index.tsx:117`. Format → [../format/space/tasklists/README.md](../format/space/tasklists/README.md).

### Knowledge views

Three levels, all VFS-backed:

- **Knowledge landing** (`knowledge/index.tsx`) — globs `knowledge/*/*/index.md`, groups by domain, and renders each domain either as a flat list of `FieldCard`s or as a `TabBar` when that domain's `index.md` sets `renderAs: tabs` (a studio-only hint; the agent runtime ignores it) `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/knowledge/index.tsx:39-70`. The inline create form writes `knowledge/<domain>/<field>/index.md` via `serializeKnowledgeFieldIndex` `…/knowledge/index.tsx:104-118`. Field ids in the URL are encoded `<domain>---<field>` `…/knowledge/index.tsx:87-92`.
- **Field detail** (`knowledge/$fieldId/index.tsx`) — decodes `domain---field` `…/knowledge/$fieldId/index.tsx:29-32`, lists the field's options (`*.md` minus `index.md`) in a left rail with rename/delete, and renders either `FieldIndexPanel` (for `index.md`) or `TopicEditor` (for an option) on the right `…/knowledge/$fieldId/index.tsx:249-275`. Rename is duplicate-then-delete `…/knowledge/$fieldId/index.tsx:93-104`.
- **Domain metadata** (`knowledge/domain/$domainId`) → `DomainMetadataPanel` — label, icon, color, `renderAs` (tabs/list), description `sdk/org/libs/ui/src/studio/knowledge/domain/domain-metadata-panel/index.tsx:23-48`.

`FieldIndexPanel` edits the field's frontmatter: `type`, `label`, `variable`, `default`, `fieldType`, `required`, `description` `sdk/org/libs/ui/src/studio/knowledge/field/directory-metadata-panel/index.tsx:39-56`. `fieldType` is a render hint naming a catalog control (`text`, `textarea`, `number`, `select`, `multiselect`, `combobox`, `radio`, `checkbox`, `toggle`, `slider`, `date`) `…/directory-metadata-panel/index.tsx:25-38`.

`TopicEditor` splits frontmatter from the body on load and edits only the body, with a markdown toolbar, an edit/preview mode switch, a collapsible `FileMetadataPanel`, and an imperative `save()` handle `sdk/org/libs/ui/src/studio/knowledge/topic-detail/topic-editor/index.tsx:26-60`. Format → [../format/space/knowledge/README.md](../format/space/knowledge/README.md).

### Raw files
`sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/raw/index.tsx:1-13` — `useGlobRead('**/*')` → `buildTree` → an expandable tree plus a read-only content viewer. No writes.

### Space settings (`SettingsView`)
`sdk/org/libs/ui/src/studio/shell/settings-view/index.tsx:33-174` — two tabs, **Environment** and **package.json** `…/settings-view/index.tsx:87-100`.

> **Both tabs are stubs.** The Environment tab's Load/Save buttons only set a status string `sdk/org/libs/ui/src/studio/shell/settings-view/index.tsx:127-130`; the package.json tab's Save only `JSON.parse`-validates the draft and stamps a timestamp `…/settings-view/index.tsx:157-165`. Neither writes to the VFS or the pod.
>
> `SettingsView` also references `<Stack>` at `sdk/org/libs/ui/src/studio/shell/settings-view/index.tsx:79` with no corresponding import (`…/settings-view/index.tsx:5-19` imports `Page`/`Heading`/`Caption`/`cn` but not `Stack`), and `@lmthing/ui` has no `typecheck` script — only `lint`/`lint:tokens`/`format` `sdk/org/libs/ui/package.json:23-27` — so nothing catches it at build time.

---

## Chat views

### THING dock (`ThingDock`)
`sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/route.tsx:10-33`

The `rightPanel` passed into `StudioLayout` from the **space** layout route — so the dock exists only inside `/studio/$projectId/$spaceId/*`, not on the project landing or the app tabs. It is an `AgentChatPanel` from `@lmthing/ui/chat` in `agentOnly` mode against the `thing` agent; its `getAccessToken` best-effort POSTs the gateway `/api/compute/ensure` first so the pod is awake before the socket opens `…/$spaceId/route.tsx:12-31`. Rendering is gated by the `studio-shell.thing.open` toggle (default off) — see `StudioShell` above.

`/studio/thing` is the same panel full-page `sdk/org/apps/web/src/routes/studio/thing/index.tsx`.

> `ThingPanel` (`sdk/org/libs/ui/src/studio/thing/thing-panel/index.tsx`, exported from `@lmthing/ui/studio`) is **not** used by `apps/web` — both the dock and `/studio/thing` use `AgentChatPanel` from `@lmthing/ui/chat`.

### Run-the-space chat
`sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/agent/$agentId/chat/index.tsx:39-223`

The one studio view that pushes the space to the pod and runs it:

1. `ensurePod` → gateway `POST /api/compute/ensure` `…/chat/index.tsx:15-27`
2. read the whole space out of the VFS (`useGlobRead('**/*')`), dropping `conversations/` and `.env*` `…/chat/index.tsx:29-52`
3. `ReplRpcClient.syncSpace` → `POST {pod}/api/spaces` (the space name is sanitized to one path-safe segment) `…/chat/index.tsx:56-86`
4. `ReplRpcClient.createSession` → `POST {pod}/api/sessions {spaceDir, agentSlug}` `…/chat/index.tsx:89-96`
5. stream via `useReplSession` (WS `/api/ws?sessionId=…`), rendering `DisplayBlock` / `AskBlock` / `VariablesBlock` / error blocks `…/chat/index.tsx:115-200`

It auto-starts only once the VFS has hydrated (starting on bare mount would sync an empty space) `…/chat/index.tsx:105-113`, shows phase labels (`provisioning` → `syncing` → `starting` → `ready`) `…/chat/index.tsx:225-231`, and offers **↻ Re-sync & restart** to push unsaved edits and restart the agent `…/chat/index.tsx:161-168`. Endpoints → [../cli-api/rest/spaces.md](../cli-api/rest/spaces.md), [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

---

## App admin tabs (`/studio/$projectId/app`)

Project-scoped, **not** space-scoped: this subtree renders its own chrome and `TabBar` instead of `StudioLayout`, so it has no space rail and no THING dock `sdk/org/apps/web/src/routes/studio/$projectId/app/route.tsx:12-19,27-64`. Tabs: `Manifest | Data | Files | Preview` `…/app/route.tsx:20-25`.

All four talk to the **management** API on the pod, `{COMPUTER_BASE_URL}/api/projects/<id>/…` (the reserved top-level `/api`, distinct from the app's own `/app/<project>/api/*`), through `authFetch` (bearer + one 401-refresh retry) `sdk/org/apps/web/src/routes/studio/$projectId/app/-lib/appApi.ts:1-16,40-42`.

| Tab | Renders | Calls |
|---|---|---|
| **Manifest** | build card + status badge, tables with column chips (`:type pk req uniq`), pages, endpoints (`METHOD`, name, route, in/out types), hooks with **Run now** `sdk/org/apps/web/src/routes/studio/$projectId/app/index.tsx:194-307` | `GET …/app`, `GET|POST …/app/build`, `POST …/hooks/:slug/run` `…/app/-lib/appApi.ts:21-36` |
| **Data** | table picker from the manifest, 25-row pages, inline cell edit patched by the table's primary-key column (falls back to `id`) `sdk/org/apps/web/src/routes/studio/$projectId/app/data/index.tsx:13-49` | `GET …/app/data/:table`, `PATCH …/app/data/:table/:id` |
| **Files** | tree derived from `manifestFilePaths(manifest)` + a plain `<textarea>` editor — no code editor ships in `apps/web`/`@lmthing/ui` `sdk/org/apps/web/src/routes/studio/$projectId/app/files/index.tsx:10-17,111,221` | `GET|PUT …/app/files/<path>` (the path-scoped API's `.data/`/`types/` refusals surface as the save error) |
| **Preview** | same-origin `<iframe>` of `{COMPUTER_BASE_URL}/app/<project>/`, with Refresh (remount by key) and Open-in-new-tab `sdk/org/apps/web/src/routes/studio/$projectId/app/preview/index.tsx:20-58` | — |

The Preview tab is deliberately **not** sandboxed away from same-origin: the preview must be byte-identical to CLI/prod serving, and the strict CSP on the served pages is the control, not the iframe boundary `sdk/org/apps/web/src/routes/studio/$projectId/app/preview/index.tsx:8-19`.

Endpoint shapes → [../format/project/api/README.md](../format/project/api/README.md) and [../format/project/pages/README.md](../format/project/pages/README.md).

`ManifestView` renders "This project has no app layer (spaces-only project)" when the manifest reports `hasApp: false` `sdk/org/apps/web/src/routes/studio/$projectId/app/index.tsx:176-178`.

---

## Project settings

### `ProjectSettingsView`
`sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:53-232`

The `/studio/$projectId/settings` landing. One section — **Integrations** — over the same sidebar shell `…/project-settings-view/index.tsx:134-137`:

1. `GET {pod}/api/projects/:id/integrations` → the integration spaces installed in this project `…/project-settings-view/index.tsx:75`
2. per integration: an optional bundled README rendered as a collapsible "How to get your keys — setup guide" `…/project-settings-view/index.tsx:185-194`, then a `SettingsSchemaForm` over its `settings` JSON Schema `…/project-settings-view/index.tsx:195-200`
3. current values prefilled from `GET {cloud}/api/compute/env` `…/project-settings-view/index.tsx:93-99`
4. **Save & Restart Pod** — re-reads the env, overlays only this page's keys, and `PUT {cloud}/api/compute/env` (the PUT **replaces the whole var set**, hence the GET-merge-PUT) `…/project-settings-view/index.tsx:108-132,216-224`

Installing is *not* done here — the empty state links out to the store `…/project-settings-view/index.tsx:154-171`.

`SettingsSchemaForm` `sdk/org/libs/ui/src/studio/integrations/SettingsSchemaForm.tsx:46-60` is a deliberately minimal JSON-Schema renderer: object-of-string properties only, `title` as the label, `format: 'password'` masked, `description` as the placeholder, `required[]` marking required fields — and **the schema's property keys ARE pod env-var names** `…/SettingsSchemaForm.tsx:1-11,19-33`.
