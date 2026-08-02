# `/chat` — features

What the chat surface actually does, and which pod / gateway endpoint each feature calls.

The `/chat` routes themselves are thin — a layout that wraps the subtree in `PodEnsureGate` (`sdk/org/apps/web/src/routes/chat/route.tsx`) and three leaves (`/chat`, `/chat/$projectId`, `/chat/$projectId/$sessionId`) that render `<ChatShell/>` from `@lmthing/ui/chat` with the project and conversation their URL names (`sdk/org/apps/web/src/routes/chat/-shell.tsx#ChatRouteShell`). Every feature below is implemented in `sdk/org/libs/ui/src/chat/**`. See [routes.md](./routes.md) for the route tree and [views.md](./views.md) for the component layout.

Two origins are in play. Same-origin `/api/*` is the **pod** (the CLI server — see [../cli-api/rest/README.md](../cli-api/rest/README.md)); `dataPlaneOrigin('cloud')` is the **gateway** (`sdk/org/libs/ui/src/lib/app-urls.ts`, `dataPlaneOrigin`).

---

## Auth on every call

Every pod fetch carries `authorization: Bearer <gateway JWT>` from the `@lmthing/auth` localStorage session (`sdk/org/libs/ui/src/chat/app/auth.ts:12-20`, `getAccessToken` / `authHeaders`). The WebSocket cannot send headers, so the token rides as `&access_token=…` (`auth.ts:23-26`, `wsTokenSuffix`), and `<img>`/`<audio>`/`<a>` for stored uploads use `withAuthToken(url)` to append `?access_token=…` (`auth.ts:37-42`). In production Envoy's `chat-jwt` SecurityPolicy validates `/api/*` from the header **or** that query param and routes by the `sub` claim to the user's pod (`auth.ts:28-36`).

---

## Pod readiness, upgrade, keep-warm

`PodEnsureGate` (shared by all four surfaces) wraps the whole `/chat` subtree (`sdk/org/apps/web/src/routes/chat/route.tsx`). It:

- POSTs `{CLOUD}/api/compute/ensure` to cold-wake the pod (`sdk/org/apps/web/src/lib/gates.tsx#ensurePod`);
- polls `GET {CLOUD}/api/compute/status` for monotonic boot progress (`gates.tsx:99`);
- then probes the **pod edge** with same-origin `GET /api/sessions` until it stops returning an Envoy 503/504 — the K8s startup probe passing does not mean the Envoy route is wired yet (`gates.tsx:119-143`) → [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md);
- compares the running image tag against `GET {CLOUD}/api/compute/version` (`gates.tsx:61`) and offers `POST {CLOUD}/api/compute/upgrade` (`gates.tsx:75`), re-polling every 60 s while live (`UPGRADE_POLL_MS = 60_000`, `gates.tsx:197`);
- POSTs `/api/keepalive` every 5 minutes while the tab is visible (`KEEPALIVE_MS = 5 * 60_000`, `gates.tsx:202,339-350`) → [../cli-api/rest/misc.md](../cli-api/rest/misc.md).

Because the gate has already confirmed the edge is serving, `ChatShell`'s boot fetch of `GET /api/projects` is a single un-retried call (`sdk/org/libs/ui/src/chat/app/ChatShell.tsx:18-30`) → [../cli-api/rest/projects.md](../cli-api/rest/projects.md).

---

## THING chat & sessions

### Boot and project selection

`ChatShell` fetches `GET /api/projects` and stores them. When the location names no project (`/chat`), it **redirects** — replacing the history entry, not pushing one — to the project with id `user` (else `projects[0]`), then applies/syncs the `?node=&tab=&follow=` view state (`sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`). The sidebar repeats the fetch to keep the list fresh, but no longer picks a default of its own: that would leave the URL saying `/chat` while the app showed a project (`sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar`). Which project is open is a **route param** — see [routes.md](./routes.md) §3.

### Sidebar — projects, app pages, spaces, conversations

`Sidebar` drives (all pod, same-origin):

| Action | Endpoint | Code |
|---|---|---|
| list projects | `GET /api/projects` | `Sidebar.tsx:109` |
| create project | `POST /api/projects {name}` | `Sidebar.tsx:150` |
| delete project | `DELETE /api/projects/:id` | `Sidebar.tsx:158` |
| conversation list | `GET /api/projects/:id/sessions` | `Sidebar.tsx:94` |
| spaces list | `GET /api/projects/:id/spaces` | `Sidebar.tsx:101` |
| app pages (the `APP` section) | `GET /api/projects/:id/app` | `use-app-pages.ts#useAppPages` |
| per-token pricing | `GET /api/prices/azure` | `Sidebar.tsx:123` |
| new chat | `POST /api/sessions {projectId}` | `session-control.ts#startSession` |
| open/resume chat | `POST /api/sessions {projectId, resumeSessionId}` | `session-control.ts#openSession` |
| delete chat | `DELETE /api/sessions/:id` | `Sidebar.tsx#Sidebar` |

Sessions are grouped Today / Yesterday / Last 7 days / Older by `lastActivity` (`Sidebar.tsx:35-51`) and each row shows its cost (`totalCostUsd`, or the live store cost for the active session) (`Sidebar.tsx:222-223`). Clicking a **space** navigates out to Studio (`crossAppOrigin('studio')` + `/studio/<projectId>/<spaceId>`, `Sidebar.tsx:191-194`). The footer is the shared `SidebarFooter` — cross-app links plus an account row that opens the global settings dialog (`Sidebar.tsx:261`; see [The shared settings dialog](#the-shared-settings-dialog-sidebar-footer) below).

Opening, switching and ending the live session is `sdk/org/libs/ui/src/chat/app/session-control.ts` — one module owns the socket, so the sidebar is not the only surface that can start a chat (the shell's no-session pane calls the same `startSession`, see [Mobile: the chat surface with no conversation open](../mobile/README.md#the-chat-surface-with-no-conversation-open)).

Clicking a listed chat does **not** fetch here: it navigates, and the shell's location effect does the resuming (`sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar`). Both deletes navigate away *before* the DELETE lands, so the surface never flashes "that project isn't here" for something the user removed on purpose.

Both create and resume go through the same pod route — `POST /api/sessions` accepts `{spaceDir?, agentSlug?, spaceRef?, model?, projectId?, resumeSessionId?, budget?}` and answers `201 {sessionId}`; under memory pressure it answers `503` + `Retry-After: 5` (`sdk/org/libs/cli/src/server/routes/sessions.ts#handleCreateSession`) → [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

### The live socket

`switchSession(sessionId)` closes any previous connection, resets the store, opens `WS /api/ws?sessionId=<id>&access_token=<jwt>` and publishes the sender on `window.__LM_SEND__` — the seam every other component uses to talk to the agent (`Sidebar.tsx:37-46`).

Server → client messages handled by the store's WS client: `hello`, `trace_snapshot` (wholesale model rebuild on connect/resume/reconnect, recovering the agent-set session title), `trace` (batched per animation frame), `ask_start` / `ask_end` / `ask_pending`, `error`, `done`, and `ui_control` — the agent can drive the UI (select a node, switch inspector tab, toggle follow, seek) (`sdk/org/libs/ui/src/chat/store/ws-client.ts#createConnectLive`). Reconnect is exponential backoff capped at 8 s (`ws-client.ts:57`).

Client → server messages accepted by the pod's agent socket: `sendMessage` (with attachment ids), `submitForm`, `cancelAsk`, `subscribeTrace` (`sdk/org/libs/cli/src/server/ws/agent.ts:86-104`).

### Transcript

`ChatView` groups blocks into user messages and assistant turns (`sdk/org/libs/ui/src/chat/app/ChatView.tsx#groupBlocks`), renders the header (title, session cost, follow toggle, connection dot, trace loader, Inspect, Report bug, theme toggle, restart) and the message list, with the single live `<StatusLine/>` sentence under the header title (`ChatView.tsx:213-294`). `handleSend` echoes the message into the transcript (`noteUserMessage`) and pushes it over the socket — unless a budget window is exhausted, in which case the send is refused outright (`ChatView.tsx:160-166`).

The header title is whatever the agent set via `setSessionMeta` (a `session_meta` trace event), falling back to `<space/project> · <Agent>` (`ChatView.tsx:157-173`).

### Composer — completions, attachments, voice

`Composer` (`sdk/org/libs/ui/src/chat/app/Composer.tsx`):

- `@`-autocomplete from `GET /api/projects/:id/completions` (`Composer.tsx:82-88`) → [../cli-api/rest/projects.md](../cli-api/rest/projects.md);
- file attachments — each picked file is read as a base64 data URL and POSTed to `/api/uploads` as `{filename, mediaType, data}`, returning an `UploadedAttachment` staged on the pending message (`Composer.tsx:110-127`) → [../cli-api/rest/uploads.md](../cli-api/rest/uploads.md). The picker's `accept` list covers images, audio and every document type the `system-files` reader can extract (PDF, txt/md/csv, Office + OpenDocument) (`Composer.tsx:26-46`);
- voice — `MediaRecorder` captures a clip, uploads it through the same endpoint, and the returned ref carries a **server-side transcript** which is what rides to the model (`Composer.tsx:146-190`);
- Enter sends, Shift+Enter newlines (`Composer.tsx:388-391`); the input is disabled in replay mode or when `budgetBlocked` (`Composer.tsx:114`).

**Draft persistence.** The composer's text is saved per session through the `platform/storage` seam (`localStorage` on web, `AsyncStorage` on native — [../libs/README.md](../libs/README.md)) so an accidental reload, a crash, or a phone killing the tab does not lose an unsent message: a 400 ms debounced write while typing, an immediate clear on send, and a restore-on-mount that only ever applies to the session that owns the key (`sdk/org/libs/ui/src/chat/app/Composer.tsx#draftStorageKey`, effects at `Composer.tsx:126-166`). `ChatView` already remounts `Composer` keyed on `activeSessionId` when the session switches, which is what makes "on mount" the same moment as "for this session" — no separate switch to guard against.

**Edit-and-resend.** A sent user message's Copy button is joined by Edit (`sdk/org/libs/ui/src/chat/app/Message.tsx#EditButton`), which reopens the text in the composer via a one-shot store mailbox (`startEditMessage` → `editDraft` → `clearEditDraft`, `sdk/org/libs/ui/src/chat/store/session-slice.ts`). Resending drops that block and everything after it from the LOCAL transcript first (`truncateFromBlock`, `session-slice.ts`), so a corrected question is never followed by the answer to the old one. This is a view-only fix: the WS protocol has no rewind/rewrite message (`ClientMessage`, `sdk/org/libs/cli/src/rpc/events.ts`), so the agent's own memory of the original exchange is untouched — the edited text just rides as a new turn on top of it (`Composer.tsx:209-236`, the reasoning is in a comment at the `truncateFromBlock` call).

Rendered attachments in the transcript use `withAuthToken(att.url)` so `<img>`/`<audio>` GETs of `/api/uploads/:id` are routed to the right pod (`sdk/org/libs/ui/src/chat/app/Message.tsx#UserAttachment`).

### Ask forms and consent cards

An `ask()` yield arrives as an `ask_start` message and renders as an `AskForm`. Submission goes back over the same socket as `{type:'submitForm', id, value}` (`Message.tsx:36-42`). Descriptor dispatch order: a space-authored component from `window.__SPACE_COMPONENTS__`, else the core form catalog (`CatalogForm`), else a plain text input (`Message.tsx:60-75`).

A **consent-marked** call (today `installSpace`, or any space function tagged `@consent`) rides the same `ask` channel as a `{type:'ConsentCard', props:{function, space?, argsSummary}}` descriptor; Approve submits `true`, Deny submits `false` — **both resolve the ask**, so a denied card never hangs the agent (`sdk/org/libs/ui/src/chat/components/ConsentCard.tsx:5-24`, wired at `Message.tsx:60-66`).

### Cost and budget

Per-token pricing comes from `GET /api/prices/azure` (`Sidebar.tsx:123`); in-flight LLM cost is accumulated from `llm_request`/`llm_progress`/`llm_response` trace events in the session slice, and the header shows `sessionCostUsd + sessionCostInflight` (`ChatView.tsx:112`).

`BudgetWindows` renders one muted line under the composer from same-origin `GET /api/budget` — Today / Week / Month remaining %, refreshed every 30 s and after every cost change; red under 15 % (`sdk/org/libs/ui/src/chat/app/BudgetWindows.tsx#POLL_MS,36-59,66-79`) → [../cli-api/rest/budget.md](../cli-api/rest/budget.md). A window at exactly **0 %** sets `store.budgetBlocked`, which hard-disables the composer (LiteLLM would 429 the turn anyway) (`BudgetWindows.tsx:29-34`, consumed at `ChatView.tsx:118-119` and `Composer.tsx:66`). The endpoint 404s off lmthing.cloud, and the line then renders nothing (`BudgetWindows.tsx:39-42`).

### Restart the pod process

The header's ⏻ button POSTs `/api/restart`, then polls `GET /api/env` every 800 ms until it answers and reloads the page (`ChatView.tsx:140-155`) → [../cli-api/rest/env.md](../cli-api/rest/env.md), [../cli-api/rest/misc.md](../cli-api/rest/misc.md).

### Report a bug

`BugReportDialog` screenshots `#root` with `modern-screenshot` (dynamically imported so it stays out of the main bundle) (`ChatView.tsx:129-138`) and POSTs `{title, message, sessionId, screenshot?}` to `/api/report-bug`; the pod broker attaches the session trace and forwards to the gateway, and the dialog shows the filed issue number + URL (`sdk/org/libs/ui/src/chat/app/BugReportDialog.tsx:58-72,85-97`) → [../cli-api/rest/misc.md](../cli-api/rest/misc.md).

### Inspect, live activity, replay, deep links

- `StatusLine` is the chat's whole account of in-flight sub-agent work: ONE sentence under the title (the current running fork / delegate / tasklist / task, else THING's own line). It reads `model.nodes` only and writes nothing to the transcript (`sdk/org/libs/ui/src/chat/app/StatusLine.tsx#StatusLine`).
- `DevPanel` (execution tree + inspector) opens on `Alt+I` or `?inspect=1` (`sdk/org/libs/ui/src/chat/app/AppShell.tsx:64,89-94`).
- **Keyboard shortcuts** (web only — `platform/keyboard`'s `onKeyDown` is a documented no-op on native, so this needs no separate native fork): `Alt+N` starts a new session in the active project (shares `Alt+I`'s modifier rather than `Ctrl`/`Cmd`+N, which every browser reserves for a new window); bare `/` focuses the composer, the same convention GitHub/Slack/Discord/Notion use, and is skipped whenever an editable element already has focus so it never steals a `/` the user meant to type (`AppShell.tsx#isEditableTarget`, effect at `AppShell.tsx:96-121`). Neither is offered in a `singleSession` embedding without a project to hold the new session.
- URL state is deep-linkable at two levels: the **location** (`/chat/<project>/<conversation>`) is a route param pair the shell drives state from, and the **view** params `?node=`, `?tab=`, `?follow=0` are read into the store on mount (`applyUrlToState`) and written back via `history.replaceState` from a store subscription (`sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl`). See [routes.md](./routes.md) §3.
- The document title is the open conversation's title, prefixed by run state (`⟳ N running` / `✓ done` / `⏵ replay`) (`sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`) — the browser's own history menu is labelled by it.
- Replay mode loads a local NDJSON trace file client-side (no endpoint) and disables the composer (`Composer.tsx:263-269`).

---

## Project settings drawer

Opened from the sidebar's project row; five tabs (`sdk/org/libs/ui/src/chat/app/ProjectSettings.tsx#ProjectSettings`):

| Tab | Endpoints | Code |
|---|---|---|
| Instructions | `GET`/`PUT /api/projects/:id/instructions` | `ProjectSettings.tsx:81,88` |
| Documents | `GET`/`POST /api/projects/:id/documents` (`{name, content}`) | `ProjectSettings.tsx:116,126` |
| Spaces | `GET /api/projects/:id/spaces` | `ProjectSettings.tsx:156` |
| Integrations | see below | `ProjectSettings.tsx:215` |
| Env | `GET`/`PUT /api/env` (raw pod `.env` text) | `ProjectSettings.tsx:32,41` |

Project routes → [../cli-api/rest/projects.md](../cli-api/rest/projects.md); the raw `.env` tab → [../cli-api/rest/env.md](../cli-api/rest/env.md) (note: the **pod** `PUT /api/env` replaces the whole file with `{content}` and re-applies it to `process.env`, `sdk/org/libs/cli/src/server/routes/env.ts#handleEnvPut` `handleEnvPut`). This is a different endpoint from the gateway's `PUT /api/compute/env` (a `{vars}` map) used by the Integrations tab and the shared settings dialog.

---

## The Integrations tab

The tab that turns an installed integration **space** into a configured one, without any secret entering the LLM context (`sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:51-59`).

### 1. List what's installed

`GET /api/projects/:projectId/integrations` (same-origin, pod) (`IntegrationsTab.tsx:89`). The pod scans `<root>/<projectId>/spaces/*/package.json` and returns the entries whose `lmthing.kind === 'integration'` (`sdk/org/libs/cli/src/server/routes/store-spaces.ts#handleListProjectIntegrations`). Each entry carries:

```ts
export interface InstalledIntegration {
  spaceId: string;
  title: string;
  icon: string | null;
  tags: string[];
  settings: unknown | null;   // the lmthing.settings JSON Schema
  readme: string;             // the space's bundled README.md, '' if none
  missingRequired: string[];  // required env-var NAMES still unset — never values
  configured: boolean;        // missingRequired.length === 0
}
```

(`store-spaces.ts:462-475`.) `missingRequired` is computed by taking the settings schema's `required[]` — whose entries **are pod env-var names** — and keeping those absent or empty in `process.env` (`store-spaces.ts:477-491,572`). **Only the names leave the pod; the values never do** (`store-spaces.ts:469-472`). The same function backs the agent-facing `integrationStatus(spaceId)` global, so the agent's view and the UI badge cannot diverge (`store-spaces.ts:493-518`).

The card shows `configured` or "*N* keys needed" from `missingRequired.length` (`IntegrationsTab.tsx:248-254`) and renders the space's README as a collapsible "Setup guide — how to get your keys" (`IntegrationsTab.tsx:257-266`).

The `lmthing.settings` schema lives in the space's manifest → [../format/space/package.json.md](../format/space/package.json.md). An integration space is an **event source**: its `events/*.ts` emitter defs produce typed events a project subscribes to → [../format/space/events/README.md](../format/space/events/README.md).

### 2. Render the schema form

`SettingsSchemaForm` renders one `<Input>` per `schema.properties` entry, labelled by `title` (falling back to the key), placeholder from `description`, and masked when `format: 'password'`; `required[]` marks the mandatory fields (`sdk/org/libs/ui/src/studio/integrations/SettingsSchemaForm.tsx`, invoked at `IntegrationsTab.tsx:268-276`). Current values are prefilled from `GET {CLOUD}/api/compute/env` → `{vars}` (`IntegrationsTab.tsx:107-112`; gateway side `cloud/gateway/src/routes/compute.ts:324-329`). A schema with no properties renders "This integration has no configurable settings" (`IntegrationsTab.tsx:274-276`).

### 3. Show the public inbound URL

`GET {CLOUD}/api/inbound` returns `{ baseUrl, token, bindings[] }`, where `baseUrl` is the signed public broker URL and `bindings` are the webhook paths the pod has published (`cloud/gateway/src/routes/inbound.ts:52-63`). The tab filters bindings to the active project and displays `${baseUrl}/${binding.path}` with a Copy button (`IntegrationsTab.tsx:123-137,241,278-298`).

### 4. Save → restart → auto-resume

The save flow (`IntegrationsTab.tsx:182-219`):

1. **GET-merge-PUT.** The gateway's `PUT /api/compute/env` **replaces the entire var set**, so the tab re-reads `GET {CLOUD}/api/compute/env` and overlays only this integration's keys before writing (`overlayEnvKeys` in `sdk/org/libs/ui/src/chat/app/auto-resume.ts#overlayEnvKeys`; call site `IntegrationsTab.tsx:191-199`). An absent field becomes `''` (an explicit unset), never a dropped key (`auto-resume.ts:18`).
2. **The PUT restarts the pod.** The gateway writes the `user-env` K8s secret and then patches the `lmthing` deployment to force a rolling restart (`cloud/gateway/src/lib/compute.ts#setEnvVars`, "Trigger rolling restart so pods pick up the new env vars"; route at `cloud/gateway/src/routes/compute.ts:338-339`).
3. **Wait for the pod to come back.** `waitForPodReady` polls a probe every 1 s (90 s timeout, 1.5 s initial delay — the *old* pod still answers for a beat) (`auto-resume.ts:45-56`). The probe requires **both** that same-origin `GET /api/env` is OK **and** that the chat socket is `open`, so the follow-up message can never be dropped against a closed socket (`IntegrationsTab.tsx:145-155`).
4. **Post exactly one resume nudge.** On success the tab calls `onConfigured(spaceId, resumeMessage(spaceId))` (`IntegrationsTab.tsx:157-161`), where the message is the stable string ``Integration "<spaceId>" is now configured — please continue.`` (`auto-resume.ts:60-62`). The chat shell echoes it into the transcript **and** sends it over the live socket as a `sendMessage` — so it is a **user** message, not a system message (`sdk/org/libs/ui/src/chat/app/AppShell.tsx:30-34`).
5. **Refresh the badge.** The integrations list is refetched so the card flips to `configured` (`IntegrationsTab.tsx:163-171`).

Failure handling is explicit rather than silent: an in-flight `Set` guards double saves/posts (`IntegrationsTab.tsx:77,184-185`), a save error surfaces inline, and a restart timeout throws deliberately so the UI can offer a **Retry** instead of dropping the nudge (`auto-resume.ts:40-56`; states + Retry at `IntegrationsTab.tsx:36-43,300-325`).

---

## The shared settings dialog (sidebar footer)

The sidebar's footer is the shared `SidebarFooter` (`Sidebar.tsx:243`), whose account row opens the shared `SettingsDialog` — the same component studio uses, mounted with no `initialTab` so it always opens on **Account** (`sdk/org/libs/ui/src/elements/nav/sidebar-footer/index.tsx:52`; default `initialTab = 'account'`, `sdk/org/libs/ui/src/elements/nav/settings-dialog/index.tsx#SettingsDialog`).

It is side-tabbed with **eight** tabs, declared in one `TABS` array (`settings-dialog/index.tsx:32-94`); the active tab's `render()` is the only panel mounted (`settings-dialog/index.tsx:121,157-163`). Each tab is a component under `sdk/org/libs/ui/src/elements/settings/`:

| Tab | What it does | Endpoints |
|---|---|---|
| **Account** | avatar, name/email, Log out — **no endpoint**; reads the `@lmthing/auth` session (`settings/account/index.tsx:21-22`) | — |
| **Models** | map short aliases to model specs + pick a default; loads current aliases from the gateway env and pricing from the pod, saves back with a GET-merge-PUT | `GET`/`PUT {CLOUD}/api/compute/env`, `GET {POD}/api/prices/azure` (`settings/models/index.tsx:72-73,111-119`) |
| **Environment** | pod env vars (model-alias keys are hidden here — the Models tab owns them, and are re-read and merged back on save because the PUT replaces the whole set) | `GET`/`PUT {CLOUD}/api/compute/env` (`settings/env-vars/index.tsx:30,67-73`) |
| **Billing** | opens the Stripe customer portal in place (`{portal_url}`) | `POST {CLOUD}/api/billing/portal {return_url}` (`settings/billing/index.tsx:11-15`; gateway `cloud/gateway/src/routes/billing.ts:99`) |
| **Triggers** | the inbound webhook URLs that trigger agents | `GET {CLOUD}/api/inbound` (`settings/triggers/index.tsx:42`) |
| **Sessions** | every chat and hook session — delegates, inputs, token cost | `GET {POD}/api/session-ledger` (`settings/sessions/index.tsx:98`; pod route `sdk/org/libs/cli/src/server/serve.ts:168`) |
| **Hooks** | scheduled / event / webhook hooks across all projects, each with an enable-disable toggle (optimistic, rolled back on failure) | `GET {POD}/api/hooks`, `POST {POD}/api/projects/:projectId/hooks/:slug/disabled {disabled}` (`settings/hooks/index.tsx:65,85-89`; pod routes `serve.ts:225-226`) |
| **Backup** | GitHub workspace backup: connect the App, set `repo`/`auto`/`intervalMinutes`, back up now, restore | `GET {POD}/api/backup/status`, `POST {POD}/api/backup`, `POST {POD}/api/restore`, `GET`/`PUT {CLOUD}/api/backup/config`, `GET {CLOUD}/api/backup/install-url` (`settings/backup/index.tsx:58,67,86,100,118,133`) |

`{POD}` and `{CLOUD}` above are `dataPlaneOrigin('computer')` / `dataPlaneOrigin('cloud')` — in production the pod is same-origin and the gateway is `https://lmthing.cloud` (`sdk/org/libs/ui/src/lib/app-urls.ts#dataPlaneOrigin`). Per-project integrations are deliberately **not** a tab here: env vars are pod-global while integrations are per-project, so they live in the project settings drawer (above) and in studio's `ProjectSettingsView` (`settings-dialog/index.tsx:103-112`).

---

## Endpoint index

Pod (same-origin, `Bearer` from `@lmthing/auth`):

| Endpoint | Feature | Doc |
|---|---|---|
| `GET`/`POST /api/projects`, `DELETE /api/projects/:id` | sidebar projects | [../cli-api/rest/projects.md](../cli-api/rest/projects.md) |
| `GET /api/projects/:id/sessions` · `/spaces` · `/app` · `/completions` · `/instructions` · `/documents` · `/integrations` | sidebar, settings drawer, composer | [../cli-api/rest/projects.md](../cli-api/rest/projects.md), [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md) |
| `POST /api/sessions`, `DELETE /api/sessions/:id`, `WS /api/ws?sessionId=` | new/resume/delete chat, live stream | [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) |
| `POST /api/uploads`, `GET /api/uploads/:id` | attachments + voice | [../cli-api/rest/uploads.md](../cli-api/rest/uploads.md) |
| `GET /api/prices/azure`, `GET /api/budget` | session cost, budget line | [../cli-api/rest/budget.md](../cli-api/rest/budget.md) |
| `GET`/`PUT /api/env` | Env tab, restart/readiness probe | [../cli-api/rest/env.md](../cli-api/rest/env.md) |
| `POST /api/restart`, `POST /api/keepalive`, `POST /api/report-bug`, `GET /api/sessions` (edge probe) | restart, keep-warm, bug report, pod gate | [../cli-api/rest/misc.md](../cli-api/rest/misc.md) |
| `GET /api/session-ledger`, `GET /api/hooks`, `POST /api/projects/:id/hooks/:slug/disabled`, `GET /api/backup/status`, `POST /api/backup`, `POST /api/restore` | `SettingsDialog` — Sessions / Hooks / Backup tabs | `sdk/org/libs/cli/src/server/serve.ts:168,206-208,225-226` |

Gateway (`dataPlaneOrigin('cloud')`):

| Endpoint | Feature | Source |
|---|---|---|
| `POST /api/compute/ensure`, `GET /api/compute/status`, `GET /api/compute/version`, `POST /api/compute/upgrade` | `PodEnsureGate` | `sdk/org/apps/web/src/lib/gates.tsx#ensurePod,61,75,99` |
| `GET`/`PUT /api/compute/env` | Integrations save + `SettingsDialog` Models/Environment tabs (GET-merge-PUT; PUT restarts the pod) | `cloud/gateway/src/routes/compute.ts:291,305` |
| `GET /api/inbound` | public inbound webhook URLs (Integrations tab + `SettingsDialog` Triggers tab) | `cloud/gateway/src/routes/inbound.ts:52-63` |
| `POST /api/billing/portal`, `GET /api/backup/install-url`, `GET`/`PUT /api/backup/config` | `SettingsDialog` — Billing / Backup tabs | `cloud/gateway/src/routes/billing.ts:99`, `cloud/gateway/src/routes/backup.ts:31,64,88` |
