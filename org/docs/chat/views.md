# Chat — views & components

What each component of the `/chat` surface renders, and how the agent's `display()` / `ask()` descriptors become React.

The `/chat` route itself is two files — a layout that mounts `PodEnsureGate` and an index that renders `<ChatShell/>` `sdk/org/apps/web/src/routes/chat/route.tsx:1-14` · `sdk/org/apps/web/src/routes/chat/index.tsx:1-11`. **Every chat component lives in the `@lmthing/ui/chat` package** (`sdk/org/libs/ui/src/chat/**`), whose public API is `ChatShell`, the embeddable `AgentChatPanel`, the block renderers `DisplayBlock`/`AskBlock`/`VariablesBlock`/`ConsentCard`, and the auth helpers `sdk/org/libs/ui/src/chat/index.ts:1-19`. See [./routes.md](./routes.md) for the route tree and [./features.md](./features.md) for the feature→endpoint map.

---

## Component map

| Component | File | Renders |
|---|---|---|
| `ChatShell` | `app/ChatShell.tsx` | Boot: `GET /api/projects`, default-select `user`, URL↔state, then `<AppShell/>` |
| `AppShell` | `app/AppShell.tsx` | 3-pane layout: Sidebar ∣ ChatView ∣ DevPanel (+ ProjectSettings drawer) |
| `Sidebar` | `app/Sidebar.tsx` | Projects, spaces, conversation list, new/resume/delete chat, footer |
| `ChatView` | `app/ChatView.tsx` | Header + grouped transcript + `LiveActivity` + `Composer` + bug dialog |
| `Message` / `AssistantTurn` | `app/Message.tsx` | One `ConvoBlock` (user / display / error / ask); assistant-turn grouping |
| `Composer` | `app/Composer.tsx` | Textarea, `@` completions, attachments, voice, send, `BudgetWindows` |
| `LiveActivity` / `WorkBlock` | `app/LiveActivity.tsx`, `app/WorkBlock.tsx` | Ephemeral in-flight sub-agent box (fork/delegate/tasklist/task) |
| `ActivityStrip` | `app/ActivityStrip.tsx` | Sub-agent chips under an assistant turn / ask block |
| `DevPanel` | `app/DevPanel.tsx` | Resizable aside: `ExecutionTree` + `Inspector` (+ `PlaybackBar` in replay) |
| `ExecutionTree` / `Inspector` | `app/tree.tsx`, `app/inspector.tsx` | Node tree; per-node `llm`/`statements`/`yields`/`variables`/`raw` tabs |
| `TraceLoader` / `PlaybackBar` | `app/replay.tsx` | Load a local NDJSON trace; play/scrub/speed/exit |
| `ProjectSettings` | `app/ProjectSettings.tsx` | Drawer: Instructions, Documents, Spaces, Integrations, Env |
| `IntegrationsTab` | `app/IntegrationsTab.tsx` | Installed integrations, schema form, inbound URLs, save→restart→resume |
| `BudgetWindows` | `app/BudgetWindows.tsx` | Today/Week/Month remaining %; sets `budgetBlocked` |
| `BugReportDialog` | `app/BugReportDialog.tsx` | Title/message/screenshot → `POST /api/report-bug` |
| `EmptyState` | `app/EmptyState.tsx` | "How can I help…" + 4 suggestion chips |
| `renderDescriptor` | `components/render-descriptor.tsx` | Generic JSX-descriptor → React (display blocks) |
| `CatalogForm` | `components/forms/CatalogForm.tsx` | Core's `ask()` form catalog → themed native controls |
| `ConsentCard` | `components/ConsentCard.tsx` | Host-enforced consent ask (Approve / Deny) |

(All paths relative to `sdk/org/libs/ui/src/chat/`.)

---

## Shell & layout

`ChatShell` is the whole surface: on mount it fetches `/api/projects`, picks the project with id `user` (else `projects[0]`), applies `?node=&tab=&follow=` from the URL and starts syncing state back to it, then renders `<AppShell/>` `sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`. It fetches once without retry because `PodEnsureGate` has already confirmed the pod edge is serving `sdk/org/libs/ui/src/chat/app/ChatShell.tsx:17-21`.

`AppShell` owns the responsive frame: the sidebar is docked ≥768px and a `Drawer` below; the DevPanel is docked ≥1024px and a `Drawer` below `sdk/org/libs/ui/src/chat/app/AppShell.tsx:47-55,80-83,109-171`. It also sets `document.title` from the running-node count / done / replay mode `sdk/org/libs/ui/src/chat/app/AppShell.tsx:58-66`, binds **Alt+I** to the DevPanel `sdk/org/libs/ui/src/chat/app/AppShell.tsx:69-75`, opens the DevPanel when the URL carries `?inspect=1` `sdk/org/libs/ui/src/chat/app/AppShell.tsx:41-44`, and hosts the `ProjectSettings` drawer `sdk/org/libs/ui/src/chat/app/AppShell.tsx:173-182`. With no active session it renders a placeholder instead of the transcript `sdk/org/libs/ui/src/chat/app/AppShell.tsx:142-147`.

`onIntegrationConfigured` lives here: it echoes the resume nudge into the transcript (`noteUserMessage`) **and** pushes it to the live socket through the `window.__LM_SEND__` seam `sdk/org/libs/ui/src/chat/app/AppShell.tsx:30-34`.

> `window.__LM_SEND__` is the send seam for the whole surface — `Sidebar.switchSession` publishes the live connection's `send` onto it `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#switchSession`, and `ChatView`/`Message`/`AppShell` all call it rather than holding a socket reference.

## Sidebar

Built on the shared `AppSidebar` element, it lists projects, the project's spaces, and the conversation list `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:245-269`. Conversations come from `GET /api/projects/:id/sessions` and are bucketed Today / Yesterday / Last 7 days / Older `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#groupSessionsByRecency,97-100`, each row showing a relative time and per-chat cost (live store cost for the active row, persisted `totalCostUsd` otherwise) `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:204-229`. New chat → `POST /api/sessions {projectId}`; clicking a chat resumes it → `POST /api/sessions {projectId, resumeSessionId}` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:151-166`. Both funnel through `switchSession`, which closes the old socket, `resetSession()`s the store and opens `WS /api/ws?sessionId=…&access_token=…` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#switchSession`. Clicking a space navigates to Studio via `crossAppOrigin('studio')` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:179-182`. Pricing for live cost comes from `GET /api/prices/azure` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:124-127`.

Endpoints: [../cli-api/rest/projects.md](../cli-api/rest/projects.md) · [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

## ChatView — the transcript

Header: session title, live session cost (`sessionCostUsd + sessionCostInflight`), follow toggle, `ConnectionDot`, `TraceLoader`, Inspect, Report bug, theme toggle, and a restart button `sdk/org/libs/ui/src/chat/app/ChatView.tsx:86-97,178-239`. The title prefers the agent-set session title (from `setSessionMeta`, delivered as a `session_meta` trace event) and falls back to `<project|space> · <Agent>` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:157-173`. Directly under the title the header shows the agent's live `setActivity` "currently doing" status — **only** the top-level session (THING) line, cleared when the turn goes idle `sdk/org/libs/ui/src/chat/app/ChatView.tsx:187-197`. A fork/delegate `setActivity` is **not** shown here; it sets that work node's narration in the `LiveActivity`/`WorkBlock` sub-agent panel instead (see [Sub-agent activity](#sub-agent-activity)) ([../runtime-globals/session-and-utils.md](../runtime-globals/session-and-utils.md)).

Blocks are grouped before rendering: a run of non-user blocks becomes one `AssistantTurn` (with the set of contributing node ids), a user block flushes the run `sdk/org/libs/ui/src/chat/app/ChatView.tsx#groupBlocks,257-263`. An empty transcript renders `EmptyState` with four suggestion chips that send as ordinary messages `sdk/org/libs/ui/src/chat/app/ChatView.tsx:251-255` · `sdk/org/libs/ui/src/chat/app/EmptyState.tsx#SUGGESTIONS,29-41`.

`handleSend` refuses to send when `budgetBlocked`, then optimistically pushes a user block and emits `{type:'sendMessage', content, attachments?}` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:117-123`. Restart POSTs `/api/restart`, polls `GET /api/env` every 800 ms until it answers, then reloads `sdk/org/libs/ui/src/chat/app/ChatView.tsx:141-155` ([../cli-api/rest/env.md](../cli-api/rest/env.md), [../cli-api/rest/misc.md](../cli-api/rest/misc.md)).

## Composer

One textarea with: `@`-completions from `GET /api/projects/:id/completions` (arrow keys / Tab / Enter to accept) `sdk/org/libs/ui/src/chat/app/Composer.tsx:82-88,194-261`; file attachments read as base64 data URLs and `POST`ed to `/api/uploads`, staged as `UploadedAttachment` chips `sdk/org/libs/ui/src/chat/app/Composer.tsx:108-143,276-296`; voice recording via `MediaRecorder`, uploaded the same way and **transcribed server-side** so the transcript rides to the model as text `sdk/org/libs/ui/src/chat/app/Composer.tsx:145-190`; Enter to send, Shift+Enter for newline `sdk/org/libs/ui/src/chat/app/Composer.tsx:257-260,387-389`. The picker's `accept` list is the set of document types the host can extract `sdk/org/libs/ui/src/chat/app/Composer.tsx:26-46`. The composer is disabled in replay mode, when `budgetBlocked`, or while uploading `sdk/org/libs/ui/src/chat/app/Composer.tsx:66,263-269,370-380`. `BudgetWindows` renders directly underneath `sdk/org/libs/ui/src/chat/app/Composer.tsx:390`.

Endpoints: [../cli-api/rest/uploads.md](../cli-api/rest/uploads.md) · [../cli-api/rest/budget.md](../cli-api/rest/budget.md).

## Sub-agent activity

`LiveActivity` is an **ephemeral** box pinned above the composer: it reads `model.nodes` and lists every in-flight fork/delegate/tasklist/task, and returns `null` the moment nothing runs — it writes nothing into `model.blocks`, so the transcript is untouched `sdk/org/libs/ui/src/chat/app/LiveActivity.tsx:6-43` · `sdk/org/libs/ui/src/chat/app/node-meta.ts:131-142`. Each row is a `WorkBlock`: kind icon, label, one-line narration, status pill, live elapsed timer, expandable to the last 2 subtree statements + statement count + error `sdk/org/libs/ui/src/chat/app/WorkBlock.tsx#WorkBlock`. The narration is the sub-agent's own explicit `setActivity()` text when it set one (`node.activity`), otherwise its leading `// comment` on the streamed statement, falling back to the first code line `sdk/org/libs/ui/src/chat/app/WorkBlock.tsx:67` · `sdk/org/libs/ui/src/chat/app/node-meta.ts#narrationOf`. Because a delegate's statements are attributed to its inner `run` child, "what is this doing now?" is computed over the whole **subtree**, not the node `sdk/org/libs/ui/src/chat/app/node-meta.ts:63-104`.

`ActivityStrip` is the persistent counterpart: chips (max 3, then "+N more") under an assistant turn or ask block; clicking a chip selects the node and opens the DevPanel `sdk/org/libs/ui/src/chat/app/ActivityStrip.tsx#ActivityStrip`.

## DevPanel (Inspect)

A resizable aside (drag the left edge, 280–700px; drag the divider to resize the tree) holding the execution tree over the inspector, plus the `PlaybackBar` in replay mode `sdk/org/libs/ui/src/chat/app/DevPanel.tsx#DevPanel`. `ExecutionTree` renders the node hierarchy with status icon, kind badge, live duration, retry count, and the root's fork-queue counter `sdk/org/libs/ui/src/chat/app/tree.tsx:17-89`. `Inspector` shows the selected node's header (status/kind/duration/detail/error/result) and five tabs — `llm`, `statements`, `yields`, `variables`, `raw` `sdk/org/libs/ui/src/chat/app/inspector.tsx#TABS,110-146`. Replay mode is entirely client-side: `TraceLoader` parses an NDJSON trace file in the browser (no endpoint) and `PlaybackBar` plays/scrubs it `sdk/org/libs/ui/src/chat/app/replay.tsx:7-93`.

## Settings, budget, bug report

`ProjectSettings` is a right-side drawer with five tabs — Instructions (`GET/PUT /api/projects/:id/instructions`), Documents (`GET/POST …/documents`), Spaces (`GET …/spaces`), Integrations, and Env (raw pod `.env` via `GET/PUT /api/env`) `sdk/org/libs/ui/src/chat/app/ProjectSettings.tsx#ProjectSettings,23-186`.

`IntegrationsTab` lists installed integration spaces from `GET /api/projects/:id/integrations` (each with a settings JSON Schema, README, `missingRequired[]`, `configured`) `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:11-22,89`, prefills values from the gateway's `GET /api/compute/env` `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:107`, shows the public inbound-webhook URLs from `GET /api/inbound` filtered to the project `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:122-125,241,284`, and on save does a GET-merge-PUT of `/api/compute/env` (the PUT replaces the whole var set), waits for the pod to come back, and posts exactly one resume nudge into the chat through `onConfigured` `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:157-205`. Secret **values** never enter the LLM context — only the names of missing required keys are surfaced `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:53-58`.

`BudgetWindows` polls `GET /api/budget` every 30 s (and after every cost change), prints "Budget · Today X% · Week Y% · Month Z% left" (red under 15%), and a window at exactly 0% sets `budgetBlocked`, which hard-disables the composer `sdk/org/libs/ui/src/chat/app/BudgetWindows.tsx#POLL_MS,28-34,61-81`.

`BugReportDialog` collects title/message, optionally attaches a `domToPng` screenshot of `#root` taken by `ChatView.openBugReport`, and `POST`s `/api/report-bug {title,message,sessionId,screenshot}` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:129-138` · `sdk/org/libs/ui/src/chat/app/BugReportDialog.tsx:44-70`.

---

## Rendering the agent's output: `display()` and `ask()`

Both globals speak the same currency — a **JSX descriptor** `{type, props, children}` produced by the sandbox's `React.createElement` shim. See [../runtime-globals/conversation.md](../runtime-globals/conversation.md) for the agent-side contract.

### `display()` → a `display` ConvoBlock

`display(descriptor)` is fire-and-forget host-side; it coerces `number`/`boolean`/`bigint` to a string and passes objects/descriptors through unchanged `sdk/org/libs/core/src/globals/display.ts#createDisplayGlobal`. It reaches the browser as a `display` **trace event**, which the store reducer turns into a `ConvoBlock` of type `display` attributed to the emitting node `sdk/org/libs/ui/src/chat/store/model.ts:239-242`. (A legacy `display` WS message type is explicitly ignored to avoid duplicates `sdk/org/libs/ui/src/chat/store/ws-client.ts:102-104`.)

`Message` renders it full-width with no bubble, and branches on the payload type:

```tsx
{isString
  ? <MarkdownText text={block.descriptor as string} />
  : renderDescriptor(block.descriptor)
}
```
`sdk/org/libs/ui/src/chat/app/Message.tsx:224-243` — a **string** display is parsed as Markdown (`marked`) `sdk/org/libs/ui/src/chat/app/Message.tsx#MarkdownText`; anything else goes to `renderDescriptor`.

`renderDescriptor` is a recursive, case-insensitive switch over `descriptor.type` covering headings/text/strong/em/muted/kbd/code/codeblock/markdown/quote/link, media (`image`, `audio`), layout (`stack`, `row`, `columns`, `spacer`, `divider`), surfaces (`card`/`panel`, `callout`/`alert`/`banner`, `badge`/`tag`/`pill`), collections (`list`, `orderedlist`, `table`, `keyvalue`, `timeline`) and indicators (`progressbar`, `spinner`, `statcard`, `details`) `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx#renderDescriptor`. Children render recursively; a `text` prop wins over children as the body `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:16-19`. An **unknown type does not throw** — it falls through to a monospace `type: <preview>` line `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:141`, and a non-descriptor value renders as a truncated preview `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:14`.

If the block came from a sub-agent node (kind ≠ `session`/`run`), an `AttributionButton` above it opens that node in the inspector `sdk/org/libs/ui/src/chat/app/Message.tsx#AttributionButton,231-233`.

### Space-authored components

A space can ship its own `components/view/*.tsx` / `components/form/*.tsx`. The bundle registers them on `window.__SPACE_COMPONENTS__`, and the chat reads that registry first `sdk/org/libs/ui/src/chat/app/Message.tsx:18-22`. In an ask form, a registered component whose name matches `descriptor.type` **takes precedence** over the built-in renderers and is handed `{...props, onSubmit}` `sdk/org/libs/ui/src/chat/app/Message.tsx:39-40,67-68`.

### `ask()` → an `ask` ConvoBlock, resolved back over the socket

The host validates the descriptor before it ever reaches the UI: `script`/`iframe`/`object`/`embed`/`frame`/`frameset` are blocked, `dangerouslySetInnerHTML` is rejected, and `javascript:` URLs in any prop throw — recursively `sdk/org/libs/core/src/globals/ask.ts:7-58`.

Wire → store: an `ask_start` message pushes an ask block (`state:'open'`), `ask_end` resolves it, and `ask_pending` replays still-open asks after a (re)connect `sdk/org/libs/ui/src/chat/store/ws-client.ts:105-113` · `sdk/org/libs/ui/src/chat/store/model.ts:282-290`.

`AskForm` (inside `Message`) picks a renderer in this order `sdk/org/libs/ui/src/chat/app/Message.tsx#AskForm`:

1. **Consent card** — `isConsentDescriptor(d)` (`type === 'ConsentCard'`) → `<ConsentCard/>`; Approve submits `true`, Deny submits `false` `sdk/org/libs/ui/src/chat/app/Message.tsx:60-66` · `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx#isConsentDescriptor,62-122`.
2. **Space component** — a name found in `__SPACE_COMPONENTS__` `sdk/org/libs/ui/src/chat/app/Message.tsx:67-68`.
3. **Core form catalog** — `isFormDescriptor(d)` (`Form`/`Fieldset`/`Field` or any catalog control such as `Select`, `TextField`, `Slider`…) `sdk/org/libs/core/src/ui/form.ts#isFormDescriptor` → `<CatalogForm/>` `sdk/org/libs/ui/src/chat/app/Message.tsx:69-70`.
4. **Fallback** — a single text input + Send, using `props.prompt` as the placeholder `sdk/org/libs/ui/src/chat/app/Message.tsx:71-89`.

Every branch submits through the same seam:

```ts
const onSubmit = (value: unknown) => send?.({ type: 'submitForm', id: block.askId, value });
```
`sdk/org/libs/ui/src/chat/app/Message.tsx:42`

Once answered or cancelled the form goes `inert` (pointer-events off, dimmed) and shows a `✓ <answer preview>` or `cancelled` line `sdk/org/libs/ui/src/chat/app/Message.tsx#AskForm,44-58`.

`CatalogForm` flattens the descriptor with core's `flattenForm`, renders themed native controls for each `FieldSpec` kind (textarea, select, multiselect, radio, checkbox/switch, slider, number/stepper/currency, rating, date/time/datetime, color, file, taginput, password, email, otp…), coerces values with `coerceValue`, and submits a **bare value** for a single control or an object keyed by field name for a `<Form>` `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx#CatalogForm,23-100`. Bare `confirm`/`buttongroup` resolve immediately on click with no submit row `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:137-153`. It deliberately mirrors the terminal `InkForm` so `ask(<Form>…</Form>)` behaves identically in both surfaces `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:1-7`.

`ConsentCard` renders the host-emitted `{ type:'ConsentCard', props:{ function, space?, argsSummary } }` descriptor as "THING wants to run `<fn>`" + the arg summary + Approve/Deny `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx#ConsentCard,125-136`. **Both** choices resolve the ask (approve → `true`, deny → `false`), so a denied or closed card never leaves the agent hanging `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx:14-19`. See [../runtime-globals/store-and-consent.md](../runtime-globals/store-and-consent.md).

### The other block renderers (`DisplayBlock` / `AskBlock` / `VariablesBlock`)

The package also exports a **second, simpler family** of renderers `sdk/org/libs/ui/src/chat/index.ts:5-8`. They are used by the embeddable `AgentChatPanel` `sdk/org/libs/ui/src/chat/components/AgentChatPanel.tsx:237-243` (the Studio THING dock and project-app `<Chat>` pages) and by the CLI's `--web` DevTools app `sdk/org/libs/cli/src/web/app.tsx:100-112` — **not** by the `/chat` `ChatShell`, which renders via `Message` + `renderDescriptor` instead.

- `DisplayBlock` — a smaller descriptor switch (h1–h3, p, span, code, card, alert, badge, button, markdown; everything else → `<span>`) `sdk/org/libs/ui/src/chat/components/DisplayBlock.tsx#renderNode,104-106`.
- `AskBlock` — consent card first, then a `textinput`/`select`/`checkbox` form built from the descriptor's children, submitting a single value when there is one field and an object otherwise; also offers Cancel `sdk/org/libs/ui/src/chat/components/AskBlock.tsx#AskBlock,89-138`.
- `VariablesBlock` — the monospace `VARIABLES` panel (name → value) `sdk/org/libs/ui/src/chat/components/VariablesBlock.tsx#VariablesBlock`. The `/chat` surface shows variables in the Inspector's `variables` tab instead `sdk/org/libs/ui/src/chat/app/inspector.tsx#VariablesTab`.

---

## Block model (what a component can render)

```ts
export type ConvoBlock =
  | { id: string; ts: number; nodeId: string; type: 'user'; content: string; attachments?: TraceAttachment[] }
  | { id: string; ts: number; nodeId: string; type: 'display'; descriptor: unknown }
  | { id: string; ts: number; nodeId: string; type: 'error'; message: string }
  | { id: string; ts: number; nodeId: string; type: 'ask'; askId: string; descriptor: unknown; state: 'open' | 'answered' | 'cancelled'; answer?: unknown };
```
`sdk/org/libs/ui/src/chat/store/model.ts#ConvoBlock`

- **user** — right-aligned bubble with a copy button and attachment previews. `<img>`/`<audio>`/`<a>` cannot send an `Authorization` header, so their URLs carry `?access_token=` via `withAuthToken` `sdk/org/libs/ui/src/chat/app/Message.tsx#UserAttachment,198-221`. An audio attachment also shows its server-side transcript `sdk/org/libs/ui/src/chat/app/Message.tsx:160-172`. Optimistic user blocks are de-duplicated against the server's `user_message` event, which backfills the resolved attachment URLs `sdk/org/libs/ui/src/chat/store/model.ts:133-152`.
- **display** — see above.
- **error** — a destructive-toned callout `sdk/org/libs/ui/src/chat/app/Message.tsx:246-254`, pushed from the socket's `error` message `sdk/org/libs/ui/src/chat/store/ws-client.ts:114-116`.
- **ask** — see above.

`AssistantTurn` wraps a run of assistant blocks with the `✦` avatar, one copy button for all the turn's text, and the turn's `ActivityStrip` `sdk/org/libs/ui/src/chat/app/Message.tsx#AssistantTurn`.

---

## See also

- [./routes.md](./routes.md) — the `/chat` route tree and gates
- [./features.md](./features.md) — feature → endpoint map
- [../runtime-globals/conversation.md](../runtime-globals/conversation.md) — `display()`, `ask()`, `inspect()` on the agent side
- [../runtime-globals/store-and-consent.md](../runtime-globals/store-and-consent.md) — the consent model behind `ConsentCard`
- [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) · [../cli-api/rest/uploads.md](../cli-api/rest/uploads.md) · [../cli-api/rest/projects.md](../cli-api/rest/projects.md) — the endpoints these views call
