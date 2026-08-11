# Chat — views & components

What each component of the `/chat` surface renders, and how the agent's `display()` / `ask()` descriptors become React.

The `/chat` routes are a layout that mounts `PodEnsureGate` plus three leaves that render `<ChatShell/>` with the project and conversation their URL names `sdk/org/apps/web/src/routes/chat/route.tsx:1-14` · `sdk/org/apps/web/src/routes/chat/-shell.tsx#ChatRouteShell`. **Every chat component lives in the `@lmthing/ui/chat` package** (`sdk/org/libs/ui/src/chat/**`), whose public API is `ChatShell`, the embeddable `AgentChatPanel`, the block renderers `DisplayBlock`/`AskBlock`/`VariablesBlock`/`ConsentCard`, and the auth helpers `sdk/org/libs/ui/src/chat/index.ts:1-19`. See [./routes.md](./routes.md) for the route tree and [./features.md](./features.md) for the feature→endpoint map.

---

## Component map

| Component | File | Renders |
|---|---|---|
| `ChatShell` | `app/ChatShell.tsx` | Location → store + socket; `GET /api/projects`, default-project redirect, URL↔state, then `<AppShell/>` |
| `RoutePanes` | `app/RoutePanes.tsx` | `MissingPane` / `OpeningPane` — the URL names something absent, or still rehydrating |
| `AppShell` | `app/AppShell.tsx` | 3-pane layout: Sidebar ∣ ChatView ∣ DevPanel (+ ProjectSettings drawer) |
| `Sidebar` | `app/Sidebar.tsx` | Projects, the app's pages, spaces, conversation list, new/resume/delete chat, footer |
| `ChatView` | `app/ChatView.tsx` | Header (title) + grouped transcript + `StatusLine` + `Composer` + bug dialog |
| `Message` / `AssistantTurn` | `app/Message.tsx` | One `ConvoBlock` (user / display / error / ask); assistant-turn grouping |
| `Composer` | `app/Composer.tsx` | Textarea, `@` completions, attachments, voice, send, `BudgetWindows` |
| `StatusLine` | `app/StatusLine.tsx` | The one live "currently doing" sentence, directly above the composer |
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

`ChatShell` is the whole surface, and the only place the **location** becomes state: it fetches `/api/projects` once (no retry — `PodEnsureGate` has already confirmed the pod edge is serving), redirects `/chat` to the project with id `user` (else `projects[0]`), mirrors the location's project and conversation into the store, drives the live socket from the conversation, applies `?node=&tab=&follow=` and starts syncing those back, then renders `<AppShell/>` `sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`. Nothing else in the surface writes `activeProjectId`/`activeSessionId`; components navigate and the shell reacts ([routes.md](./routes.md) §3).

`AppShell` owns the responsive frame: the sidebar is docked ≥768px and a `Drawer` below; the DevPanel is docked ≥1024px and a `Drawer` below `sdk/org/libs/ui/src/chat/app/AppShell.tsx:47-55,80-83,109-171`. It also sets `document.title` from the open conversation's title plus the running-node count / done / replay mode, binds **Alt+I** to the DevPanel, opens the DevPanel when the URL carries `?inspect=1`, and hosts the `ProjectSettings` drawer `sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`. The main column shows, in order: a `mainPane` if the shell passed one (opening / not found), else `NoSessionPane` when nothing is open, else the transcript — the pane replaces the transcript rather than the whole shell, so the sidebar stays available to recover from `sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`.

`onIntegrationConfigured` lives here: it echoes the resume nudge into the transcript (`noteUserMessage`) **and** pushes it to the live socket through the `window.__LM_SEND__` seam `sdk/org/libs/ui/src/chat/app/AppShell.tsx:30-34`.

> `window.__LM_SEND__` is the send seam for the whole surface — `Sidebar.switchSession` publishes the live connection's `send` onto it `sdk/org/libs/ui/src/chat/app/session-control.ts#switchSession`, and `ChatView`/`Message`/`AppShell` all call it rather than holding a socket reference.

## Sidebar

Built on the shared `AppSidebar` element, it lists projects, the pages of the project's app (when it has one — see [App pages of the selected project](#app-pages-of-the-selected-project)), the project's spaces, and the conversation list `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:264-291`. Conversations come from `GET /api/projects/:id/sessions` and are bucketed Today / Yesterday / Last 7 days / Older `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#groupSessionsByRecency,200`, each row showing a relative time and per-chat cost (live store cost for the active row, persisted `totalCostUsd` otherwise) `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:216-241`. New chat → `POST /api/sessions {projectId}`, then navigate to it; clicking a listed chat only **navigates**, and the shell's location effect resumes it → `POST /api/sessions {projectId, resumeSessionId}` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar` · `sdk/org/libs/ui/src/chat/app/session-control.ts#openSession`. Both end at `switchSession`, which closes the old socket, `resetSession()`s the store and opens `WS /api/ws?sessionId=…&access_token=…` `sdk/org/libs/ui/src/chat/app/session-control.ts#switchSession`. Deleting the open chat drops the socket and leaves the conversation with a **replacing** navigation, so Back never returns to a dead id `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar`. Clicking a space navigates to Studio via `crossAppOrigin('studio')` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:191-194`. Pricing for live cost comes from `GET /api/prices/azure` `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:122-124`.

Endpoints: [../cli-api/rest/projects.md](../cli-api/rest/projects.md) · [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

Each row's delete (×) control is always rendered — not revealed by a mouse hover — so a session can be deleted on touch and on the native app; it shrinks back to its original size once a mouse is available (`$md`) `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:240-252`.

## ChatView — the transcript

Header: session title, live session cost (`sessionCostUsd + sessionCostInflight`), follow toggle, `ConnectionDot`, `TraceLoader`, Inspect, Report bug, theme toggle, and a restart button `sdk/org/libs/ui/src/chat/app/ChatView.tsx:217-294`. The title prefers the agent-set session title (from `setSessionMeta`, delivered as a `session_meta` trace event) and falls back to `<project|space> · <Agent>` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:196-212`. So a new chat is never title-less, the store seeds `sessionTitle` from the **first user message** (whitespace-collapsed, capped 80 chars) the moment it is sent, as a client placeholder — set by `noteUserMessage` only while no title exists yet, and overridden by a later agent `session_meta` `sdk/org/libs/ui/src/chat/store/session-slice.ts:156`. The header holds the title and nothing live: the chat's **one** status sentence sits at the other end of the view, against the composer `sdk/org/libs/ui/src/chat/app/ChatView.tsx:368-371` (see [Sub-agent activity](#sub-agent-activity)) ([../runtime-globals/session-and-utils.md](../runtime-globals/session-and-utils.md)).

Blocks are grouped before rendering: a run of non-user blocks becomes one `AssistantTurn` (with the set of contributing node ids), a user block flushes the run `sdk/org/libs/ui/src/chat/app/ChatView.tsx#groupBlocks,339-344`. An empty transcript renders `EmptyState` with four suggestion chips that send as ordinary messages `sdk/org/libs/ui/src/chat/app/ChatView.tsx:333-337` · `sdk/org/libs/ui/src/chat/app/EmptyState.tsx#SUGGESTIONS,29-41`.

`handleSend` refuses to send when `budgetBlocked`, then optimistically pushes a user block and emits `{type:'sendMessage', content, attachments?}` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:161-167`. Restart POSTs `/api/restart`, polls `GET /api/env` every 800 ms until it answers, then reloads `sdk/org/libs/ui/src/chat/app/ChatView.tsx:180-193` ([../cli-api/rest/env.md](../cli-api/rest/env.md), [../cli-api/rest/misc.md](../cli-api/rest/misc.md)).

`Composer` is keyed on `activeSessionId` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:380`, so switching sessions remounts it fresh — its draft (`text`/attachments/recording/the `@` dropdown) is local state that nothing otherwise resets when `switchSession` swaps the socket, so without the key a draft typed in one chat stayed in the box after switching to another.

The transcript is a `Prim.Scroll`, a real scrolling region on both targets (not a `Box` with CSS overflow, which Yoga does not support), and follows new output via its `stickToEnd` prop — gated on `follow && atBottom` so it does not yank a reader who has scrolled up back to the bottom — rather than an effect calling the DOM-only `scrollIntoView` `sdk/org/libs/ui/src/chat/app/ChatView.tsx:300-313`. `groupBlocks` is memoized against the block array and its length so a long session does not re-group (and every finished message re-parse its markdown) on every streamed token `sdk/org/libs/ui/src/chat/app/ChatView.tsx#ChatView`.

The connection indicator (`ConnectionDot` — a coloured glyph plus `live`/`connecting`/`replay` label) always renders, even on a phone where the rest of the header's workbench controls (follow toggle, trace loader, Inspect, bug report, restart) are hidden below the `md` breakpoint — otherwise a dropped socket on a phone looked identical to the app simply being stuck, with nothing to explain why `sdk/org/libs/ui/src/chat/app/ChatView.tsx#ConnectionDot,230-234`.

## Composer

One textarea with: `@`-completions from `GET /api/projects/:id/completions` (arrow keys / Tab / Enter to accept) `sdk/org/libs/ui/src/chat/app/Composer.tsx:106-112,279-303`; file attachments read as base64 data URLs and `POST`ed to `/api/uploads`, staged as `UploadedAttachment` chips `sdk/org/libs/ui/src/chat/app/Composer.tsx:153-184,449-482`; voice recording via `MediaRecorder`, uploaded the same way and **transcribed server-side** so the transcript rides to the model as text `sdk/org/libs/ui/src/chat/app/Composer.tsx:191-233`; Enter to send, Shift+Enter for newline `sdk/org/libs/ui/src/chat/app/Composer.tsx:298-303,390`. The picker's `accept` list is the set of document types the host can extract `sdk/org/libs/ui/src/chat/app/Composer.tsx:34-49`. The composer is disabled in replay mode, when `budgetBlocked`, or while uploading `sdk/org/libs/ui/src/chat/app/Composer.tsx:89,306-311,376`. `BudgetWindows` renders directly underneath `sdk/org/libs/ui/src/chat/app/Composer.tsx:549`.

Endpoints: [../cli-api/rest/uploads.md](../cli-api/rest/uploads.md) · [../cli-api/rest/budget.md](../cli-api/rest/budget.md).

The `@` completion dropdown is selectable on tap as well as by keyboard — `onClick`, not the mouse-only `onMouseDown` this used to be gated on — and the attach/mic/send controls are 44px touch targets on a phone (`$md` shrinks them back to 28px once a mouse is likely) `sdk/org/libs/ui/src/chat/app/Composer.tsx:376,422,440,508`. The field autofocuses on web only; a native app does not pop the keyboard the instant the surface mounts `sdk/org/libs/ui/src/chat/app/Composer.tsx:398`.

## Sub-agent activity

The chat surfaces delegation as **one sentence, not a tree**. `StatusLine` renders a single line **directly above the message input**: a pulsing dot plus the current "currently doing" text, truncated to one line, and `null` when there is nothing to say `sdk/org/libs/ui/src/chat/app/StatusLine.tsx#StatusLine`. It is **ephemeral** — it reads `model.nodes` and the store's session `activity` and writes nothing into `model.blocks`, so the transcript is untouched.

It sits against the composer rather than under the conversation title `sdk/org/libs/ui/src/chat/app/ChatView.tsx:368-370`, because that is where the reader already is: the title is glanced at once when the chat opens, while the eye stays between the newest message and the box it is about to type in. A sentence that changes every few seconds twenty lines above that is a sentence nobody reads, and on a phone the header can be scrolled past entirely. It is deliberately **outside** the transcript's `Prim.Scroll`, so it never scrolls away with the conversation — live state, not transcript.

What the sentence says, in order: a **running sub-agent** wins over THING's own line (while a delegate runs THING is suspended, so its last `setActivity` is stale), otherwise the store's session-scope `activity` `sdk/org/libs/ui/src/chat/app/StatusLine.tsx:31`. Of the in-flight fork/delegate/tasklist/task nodes, the one shown is the most recently started **running** node, preferred over a merely queued one `sdk/org/libs/ui/src/chat/app/node-meta.ts#currentWorkNode`. Its text is that sub-agent's own explicit `setActivity()` (`node.activity`), else the leading `// comment` narration of its newest statement, else its label `sdk/org/libs/ui/src/chat/app/node-meta.ts#currentWorkSentence` · `sdk/org/libs/ui/src/chat/app/node-meta.ts#narrationOf`. The label fallback is skipped when the node has none of its own: a node the store has only heard about indirectly is seeded by `ensureNode` with `label: id` `sdk/org/libs/ui/src/chat/store/model.ts:96-107`, so "its label" would be a raw uuid — the line says nothing instead and falls through to THING's own sentence. Because a delegate's statements are attributed to its inner `run` child, "what is this doing now?" is computed over the whole **subtree**, not the node `sdk/org/libs/ui/src/chat/app/node-meta.ts#latestSubtreeStatement`.

The indented, expandable box of in-flight work rows that used to sit above the composer (`LiveActivity` + `WorkBlock`) is **gone**: on a phone it was a scrolling wall of rows competing with the transcript, and its only affordances opened the DevPanel, which is desktop-only. The full execution tree is unchanged in the model and still rendered by `ExecutionTree` in the DevPanel.

`ActivityStrip` is the persistent counterpart: chips (max 3, then "+N more") under an assistant turn or ask block; clicking a chip selects the node and opens the DevPanel `sdk/org/libs/ui/src/chat/app/ActivityStrip.tsx#ActivityStrip`.

## App pages of the selected project

A project can also BE an application ([../app/](../app/README.md)). When the selected one is, the sidebar grows an **`APP` section** listing its pages as links, above `Spaces` — the chat already knows which project is selected, so it can say where the thing THING just built actually lives, and open the *page* the reader wants rather than the index, instead of leaving Studio or a hand-typed URL as the only routes to it `sdk/org/libs/ui/src/elements/nav/app-sidebar/index.tsx#AppSidebarPage`.

`Sidebar` resolves the list and hands the shared element ready-made rows (`routePath`, `label`, `href`); the element itself is presentational and renders **nothing at all** when the list is empty `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:137-148`. An absent section is the correct empty state: most projects are not applications, and a permanent "no app" row would be noise in the one place the reader scans for their conversations.

The list comes from the project's app manifest, `GET /api/projects/:projectId/app`, and is empty when that answers `hasApp:false`, when the app has no `pages/`, or when the pod cannot answer `sdk/org/libs/ui/src/chat/app/use-app-pages.ts#useAppPages` ([../cli-api/rest/apps.md](../cli-api/rest/apps.md)).

Two rules about what is listed:

- **Only linkable routes.** A page whose route has a dynamic segment (`/trips/:tripId`) has no id to put in the URL, so it is dropped rather than shown dead `sdk/org/libs/ui/src/chat/app/use-app-pages.ts#DYNAMIC_SEGMENT`. An app is reached through its index page anyway.
- **The label is the full path**, title-cased (`/` → `Home`, `/settings/profile` → `Settings / Profile`) `sdk/org/libs/ui/src/chat/app/use-app-pages.ts#pageLabel` — two pages can share a last segment, and a row that cannot be told from its neighbour is a guess, not a link.

Each row is a real anchor opening in a new tab (`Linking.openURL` on native — the `Link` primitive's own fork), because the app is served from another mount and opening it must not take the reader's live chat with it `sdk/org/libs/ui/src/elements/nav/app-sidebar/index.tsx:656-671`.

The href is the pod's own app mount, `<origin>/app/<project>/<route>` — `origin` from `apiBase()` (empty on web, the host-supplied base on native and desktop), and the `/app/` prefix dropped only on production `lmthing.app`, which serves apps at the root `sdk/org/libs/ui/src/lib/app-urls.ts#projectAppUrl` ([../app/routes.md](../app/routes.md)).

The list is refetched when a **turn finishes**, so an app the agent has just built appears without a reload — not on every `done` flip, since `done` also goes false on send and the manifest is not a free read `sdk/org/libs/ui/src/chat/app/use-app-pages.ts:59-62`.

> It used to be a chip row above the composer (`chat/app/AppPages.tsx`, deleted). Navigation belongs where the project's other navigable things already are — its spaces and its conversations — and the same links in two places on one screen is noise, not discoverability.

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
`sdk/org/libs/ui/src/chat/app/Message.tsx:312-329` — a **string** display is parsed as Markdown (`marked`) `sdk/org/libs/ui/src/chat/app/Message.tsx#MarkdownText`; anything else goes to `renderDescriptor`.

`renderDescriptor` is a recursive, case-insensitive switch over `descriptor.type` covering headings/text/strong/em/muted/kbd/code/codeblock/markdown/quote/link, media (`image`, `audio`), layout (`stack`, `row`, `columns`, `spacer`, `divider`), surfaces (`card`/`panel`, `callout`/`alert`/`banner`, `badge`/`tag`/`pill`), collections (`list`, `orderedlist`, `table`, `keyvalue`, `timeline`, `checklist`/`plan`/`tasklist`) and indicators (`progressbar`, `spinner`, `statcard`, `details`) `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx#renderDescriptor`. Children render recursively; a `text` prop wins over children as the body `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:16-19`. An **unknown type does not throw** — it falls through to a monospace `type: <preview>` line `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:141`, and a non-descriptor value renders as a truncated preview `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:14`.

The `checklist` type (spellings `checklist`/`plan`/`tasklist`) is the **dynamic plan** the agent maintains with the `todoWrite` system function: a titled box with a `done/total` count and one row per task, each row a status glyph + label — `☐` pending, `◐` in_progress (spins), `☑` completed (struck through), `✗` failed (in `--destructive`) `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx#renderDescriptor`. It renders identically on personal and team pods, and in the embedded `AgentChatPanel`/project-app `<Chat>` (both go through `renderDescriptor` via `DisplayBlock` `sdk/org/libs/ui/src/chat/components/DisplayBlock.tsx`). It is a **renderer-only alias**, not a catalog component — the model does not hand-write it, `todoWrite` emits it — so it lives in `RENDER_ALIASES`, not the catalog `sdk/org/libs/core/src/ui/descriptor.ts#RENDER_ALIASES`.

If the block came from a sub-agent node (kind ≠ `session`/`run`), an `AttributionButton` above it opens that node in the inspector `sdk/org/libs/ui/src/chat/app/Message.tsx#AttributionButton`.

### Space-authored components

A space can ship its own `components/view/*.tsx` / `components/form/*.tsx`. The bundle registers them on `window.__SPACE_COMPONENTS__`, and the chat reads that registry first `sdk/org/libs/ui/src/chat/app/Message.tsx:24-29`. In an ask form, a registered component whose name matches `descriptor.type` **takes precedence** over the built-in renderers and is handed `{...props, onSubmit}` `sdk/org/libs/ui/src/chat/app/Message.tsx:54,79-80`.

### `ask()` → an `ask` ConvoBlock, resolved back over the socket

The host validates the descriptor before it ever reaches the UI: `script`/`iframe`/`object`/`embed`/`frame`/`frameset` are blocked, `dangerouslySetInnerHTML` is rejected, and `javascript:` URLs in any prop throw — recursively `sdk/org/libs/core/src/globals/ask.ts:7-58`.

Wire → store: an `ask_start` message pushes an ask block (`state:'open'`), `ask_end` resolves it, and `ask_pending` replays still-open asks after a (re)connect `sdk/org/libs/ui/src/chat/store/ws-client.ts:105-113` · `sdk/org/libs/ui/src/chat/store/model.ts:282-290`.

`AskForm` (inside `Message`) picks a renderer in this order `sdk/org/libs/ui/src/chat/app/Message.tsx#AskForm`:

1. **Consent card** — `isConsentDescriptor(d)` (`type === 'ConsentCard'`) → `<ConsentCard/>`; Approve submits `true`, Deny submits `false` `sdk/org/libs/ui/src/chat/app/Message.tsx:72-78` · `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx#isConsentDescriptor,62-122`.
2. **Space component** — a name found in `__SPACE_COMPONENTS__` `sdk/org/libs/ui/src/chat/app/Message.tsx:79-80`.
3. **Core form catalog** — `isFormDescriptor(d)` (`Form`/`Fieldset`/`Field` or any catalog control such as `Select`, `TextField`, `Slider`…) `sdk/org/libs/core/src/ui/form.ts#isFormDescriptor` → `<CatalogForm/>` `sdk/org/libs/ui/src/chat/app/Message.tsx:81-82`.
4. **Fallback** — a single text input + Send, using `props.prompt` as the placeholder `sdk/org/libs/ui/src/chat/app/Message.tsx:83-101`.

Every branch submits through the same seam:

```ts
const onSubmit = (value: unknown) => send?.({ type: 'submitForm', id: block.askId, value });
```
`sdk/org/libs/ui/src/chat/app/Message.tsx:56`

Once answered or cancelled the form goes `inert` (pointer-events off, dimmed) and shows a `✓ <answer preview>` or `cancelled` line `sdk/org/libs/ui/src/chat/app/Message.tsx#AskForm,65-70`.

`CatalogForm` flattens the descriptor with core's `flattenForm`, renders themed native controls for each `FieldSpec` kind (textarea, select, multiselect, radio, checkbox/switch, slider, number/stepper/currency, rating, date/time/datetime, color, file, taginput, password, email, otp…), coerces values with `coerceValue`, and submits a **bare value** for a single control or an object keyed by field name for a `<Form>` `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx#CatalogForm,23-100`. Bare `confirm`/`buttongroup` resolve immediately on click with no submit row `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:137-153`. It deliberately mirrors the terminal `InkForm` so `ask(<Form>…</Form>)` behaves identically in both surfaces `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:1-7`.

`ConsentCard` renders the host-emitted `{ type:'ConsentCard', props:{ function, space?, argsSummary } }` descriptor as "THING wants to run `<fn>`" + the arg summary + Approve/Deny `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx#ConsentCard,125-136`. **Both** choices resolve the ask (approve → `true`, deny → `false`), so a denied or closed card never leaves the agent hanging `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx:14-19`. See [../runtime-globals/store-and-consent.md](../runtime-globals/store-and-consent.md).

### The other block renderers (`DisplayBlock` / `AskBlock` / `VariablesBlock`)

The package also exports a **second, simpler family** of renderers `sdk/org/libs/ui/src/chat/index.ts:5-8`. They are used by `ReplChatView` `sdk/org/libs/ui/src/chat/components/ReplChatView.tsx:79-92` — the connected-session view shared by the embeddable `AgentChatPanel` (the Studio THING dock) and project-app `<Chat>` pages `sdk/org/libs/cli/src/app/runtime/chat.tsx:121-133` — and by the CLI's `--web` DevTools app `sdk/org/libs/cli/src/web/app.tsx:100-112` — **not** by the `/chat` `ChatShell`, which renders via `Message` + `renderDescriptor` instead.

- `DisplayBlock` — delegates to `renderDescriptor`, the same renderer `/chat`'s transcript uses `sdk/org/libs/ui/src/chat/components/DisplayBlock.tsx#DisplayBlock`. It used to carry its own smaller switch (h1–h3, p, span, code, card, alert, badge, markdown; everything else → `<span>`), which meant the components an agent actually reaches for — `Stack`, `Table`, `KeyValue`, `Callout` — rendered as bare text, and the prop-only ones as nothing at all. One descriptor vocabulary, one renderer.
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

- **user** — right-aligned bubble with a copy button and attachment previews. `<img>`/`<audio>`/`<a>` cannot send an `Authorization` header, so their URLs carry `?access_token=` via `withAuthToken` `sdk/org/libs/ui/src/chat/app/Message.tsx#UserAttachment`. An audio attachment also shows its server-side transcript `sdk/org/libs/ui/src/chat/app/Message.tsx:199-211`. Optimistic user blocks are de-duplicated against the server's `user_message` event, which backfills the resolved attachment URLs `sdk/org/libs/ui/src/chat/store/model.ts:133-152`.
- **display** — see above.
- **error** — a destructive-toned callout with a **Retry** button, pushed from the socket's `error` message `sdk/org/libs/ui/src/chat/app/Message.tsx#ErrorMessage` · `sdk/org/libs/ui/src/chat/store/ws-client.ts:114-116`. Retry resends whatever `user` block was nearest before it in the transcript (echoed again via `noteUserMessage`, then re-sent over the socket) rather than leaving a network hiccup or LLM error as a dead end the reader has to retype `sdk/org/libs/ui/src/chat/app/Message.tsx#RetryButton`.
- **ask** — see above.

`AssistantTurn` wraps a run of assistant blocks with the `✦` avatar, one copy button for all the turn's text, and the turn's `ActivityStrip` `sdk/org/libs/ui/src/chat/app/Message.tsx#AssistantTurn`.

---

## See also

- [./routes.md](./routes.md) — the `/chat` route tree and gates
- [./features.md](./features.md) — feature → endpoint map
- [../runtime-globals/conversation.md](../runtime-globals/conversation.md) — `display()`, `ask()`, `inspect()` on the agent side
- [../runtime-globals/store-and-consent.md](../runtime-globals/store-and-consent.md) — the consent model behind `ConsentCard`
- [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) · [../cli-api/rest/uploads.md](../cli-api/rest/uploads.md) · [../cli-api/rest/projects.md](../cli-api/rest/projects.md) — the endpoints these views call
