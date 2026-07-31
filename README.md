# lmthing

**A complete platform for building, running and deploying AI agents** — and a super agent, **THING**,
that builds the rest for you. Describe what you want; THING creates the knowledge, spawns the
specialist agents, and orchestrates them until the thing exists: a database, an API, a web app, a
team workspace, a scheduled job that runs while you sleep.

You can use it as a chat app, as a workspace for your team, as a store of installable apps and
integrations, or as a runtime you build on. Same system underneath.

---

## The one idea everything follows from

**The model does not call tools. The model writes TypeScript.**

One statement at a time, streamed. The host evaluates each statement as it arrives — inside a
**QuickJS WASM sandbox**, against a set of globals that a **capability grant** decides an agent may
even see. There is no generic filesystem on any agent's surface. An agent that was never granted
`db:write` does not get a "permission denied"; the function is not in its world at all, not in its
types, not in its prompt.

What that buys you:

- **Real control flow.** Loops, `map`, conditionals, intermediate variables — one turn does work that
  a tool-calling loop spends ten round-trips on.
- **A typechecker in the loop.** Generated code is typechecked against generated DTS *before* it is
  saved, so faults are caught in the writer, not at 2am in production.
- **Safety by construction**, not by asking nicely.

→ [`org/docs/runtime/`](./org/docs/runtime/README.md) · [`org/docs/runtime-globals/`](./org/docs/runtime-globals/README.md)

---

## Features

### 🧠 THING — one agent that assembles the others

You talk to one agent. Behind it, THING creates **spaces** (an agent's knowledge, functions,
components, tasklists and charter as plain files on disk), **forks** itself for parallel work,
and **delegates** to specialists with narrower powers than its own. Every agent it builds is
authored in a format you can read, edit and version — not a prompt buried in a database.

→ [`org/docs/format/space/`](./org/docs/format/space/README.md) · [`org/docs/runtime/`](./org/docs/runtime/README.md)

### 🏗️ Describe an app, get an app — with a database, an API and a UI

Ask for a recipe planner, a health tracker, a trip organiser. The builder writes a **schema**, a set
of **typed endpoints** that are typechecked at save time, and a **UI authored as a spec** against
endpoints that already exist — then runs an **acceptance stage** that asks whether the app is
*right*, not merely well-shaped. It is served at a clean URL on **lmthing.app**, with its own data,
its own hooks and its own scheduled jobs.

→ [`org/docs/app/`](./org/docs/app/README.md) · [app authoring](./org/docs/runtime-globals/app-authoring.md)

### 👥 Teams — a shared workspace that pays for itself

**lmthing.team**: several people, their own accounts, one workspace. A team is not a share of
someone's account — it is its own principal, with **its own compute pod, its own tier and its own
subscription**, so nothing a team spends is billed to a member and no member's personal keys are
involved.

- **Channels, DMs, handles, pinned apps** and roles (owner / admin / member / viewer) that are
  actually enforced — a viewer's write is refused by the pod, not hidden by the UI.
- **THING lives in the channels.** Reply in a thread without `@`-mentioning it. It knows who is in
  the team, what the other channels are, and what was decided last week: `teamContext`,
  `teamMembers`, `teamChannels`, `teamHistory`, `teamPost`, `teamCreateChannel`, `teamPinApp` —
  gated by `team:read` / `team:post`.
- **Shared tasklists**, live activity, and an invite that actually tells the person they were invited.

→ [`org/docs/cloud/teams.md`](./org/docs/cloud/teams.md) · [team globals](./org/docs/runtime-globals/team.md)

### 🖥️ A desktop app — and a browser your agent and you both use

A native **Tauri v2** app for **Linux, macOS and Windows**, running the same chat / teams / dashboard
surfaces as the web app and the phone. It exists for two things a browser tab can never give an
agent: **your local files**, and **a browser that is logged in as you**.

The browser pane is a **real webview inside the app window** — not a screenshot stream, not a hidden
headless Chrome. One DOM, one cookie jar, one scroll position, watched by you and driven by the
agent at the same time. It uses WebView2 / WKWebView / WebKitGTK, which you already have, so the
download cost is **zero**. The agent gets 13 purpose-built functions — `open`, `readText`,
`elements`, `clickAt`, `typeText`, `waitFor`, `back` … — and when it opens a page, **the pane opens
visibly**. Giving an agent a browser nobody can see is the exact thing the design exists to prevent.

→ [`org/docs/desktop/`](./org/docs/desktop/README.md) · [the live browser](./org/docs/desktop/browser.md)

### 📱 A phone app that is the same app

The mobile app renders **the same source** as the web app — screens are imported from
`@lmthing/ui`, not rewritten. Push notifications sent only by your own pod, **over-the-air updates**
from a self-hosted update server with a staging→production two-stage flow, message drafts and
editing, history paging, pull-to-refresh, haptics, and an honest offline state.

→ [`org/docs/mobile/`](./org/docs/mobile/README.md)

### 📦 One file. No Node, no checkout, no install.

`lmthing` ships as a **single-file executable** (Node SEA) for 5 targets. Download it, run it, and
you have the whole pod runtime — CLI, REST API, WebSocket, agents — on a machine with nothing
installed. The **zerostack** coding agent is inside it; a browser is one command away. One tagged
release carries **every client**: desktop binaries, the Android APK and the CLI bundles.

→ [`org/docs/cli-api/bundle.md`](./org/docs/cli-api/bundle.md) · [CLI commands](./org/docs/cli-api/commands.md)

### ✉️ Sign in with an email address

**Passwordless email sign-in**, alongside GitHub. A 6-digit code *and* a magic link — and the magic
link signs in **the browser that asked for it, and nobody else**. No password to choose, leak, or
reset.

→ [`org/docs/cloud/auth.md`](./org/docs/cloud/auth.md)

### 🔧 zerostack — a real coding agent, for when the sandbox is not enough

There is deliberately no filesystem on the model surface, which leaves one gap: nothing can look at
a *live* generated app — read the project a user is complaining about, run its typechecker, open its
SQLite file. **zerostack** (a ~26 MB static Rust agent, shipped inside the compute image) is an
ordinary process with an ordinary shell, and it can. It sits at the end of a deliberate escalation
chain — THING → engineer → zerostack — and it is a leaf: it drives a shell, it does not re-delegate.

→ [`org/docs/system-spaces/zerostack.md`](./org/docs/system-spaces/zerostack.md)

### 🔌 Integrations, events, and the outside world

- **Bring-your-own-token integrations**, each one a self-contained space — adding a provider is
  adding a folder. Browse and install them from **lmthing.store**, setup guide included.
- **Events everywhere**: emitter definitions (`webhook` / `cron` / `db` / `internal`), event hooks,
  and `emitEvent` in the sandbox. Something happens outside; your agent wakes up and deals with it.
- **Inbound webhooks** brokered by the gateway straight into your pod.
- **Consent, in front of you.** Installing a space that wants powers shows you a card naming them.

→ [events & integrations](./org/docs/runtime-globals/events-and-integrations.md) · [store & consent](./org/docs/runtime-globals/store-and-consent.md)

### 🌐 Web reach and senses

`webSearch` and `webFetch` are backed by an in-cluster **headless-browser render service**, so
JavaScript-rendered pages are readable and search falls back across providers instead of dying.
Agents also read **images, audio (transcribed), spreadsheets and office documents**.

→ [render & web search](./org/docs/cloud/render.md)

### 🛍️ A store of things you can install

**lmthing.store** carries whole apps, agent spaces and integrations. Install one into your own pod
in a click; it arrives as files you own and can edit.

→ [`org/docs/product-spas/`](./org/docs/product-spas/README.md) · [apps API](./org/docs/cli-api/rest/apps.md)

### ⚡ Pods that cost nothing while you are away

Every user (and every team) gets an isolated compute pod. Free-tier pods **scale to zero** and are
woken by the edge on *any* request — cold wake takes about **a second**, with real boot progress on
screen instead of a spinner that lies. Cron jobs are externalized, so a sleeping pod still keeps its
appointments. Four tiers, multi-window budgets, and your workspace backed up to your own GitHub repo.

→ [`org/docs/devops/infrastructure.md`](./org/docs/devops/infrastructure.md) · [billing & tiers](./org/docs/cloud/billing-and-tiers.md)

---

## Where you actually use it

| Surface | What it is |
|---|---|
| **Chat** (`/chat`) | Talk to THING. Files, images, voice. It builds while you talk. |
| **Studio** (`/studio`) | Author agents, spaces, knowledge and functions by hand. |
| **Computer** (`/computer`) | The workspace filesystem view — everything your agents made. |
| **lmthing.app** | Your generated apps, served at clean URLs. |
| **lmthing.store** | Installable apps, spaces and integrations. |
| **lmthing.team** | The shared team workspace. |
| **Desktop / phone / CLI** | The same surfaces, natively, plus local files and the live browser. |

---

## Documentation — [`org/docs/`](./org/docs/README.md), published at [lmthing.org](https://lmthing.org)

> **`org/docs/` is the single source of truth for this codebase.** Every factual sentence there ends
> with a citation to the implementation that makes it true (`path#Symbol`), and `pnpm docs:check`
> resolves every one of them as a hard CI gate. When a README, a `CLAUDE.md` or a skill disagrees
> with `org/docs`, **`org/docs` wins**; when `org/docs` disagrees with the **code**, the **code**
> wins and the doc is a bug.
>
> **A code change is not done until the matching `org/docs/` page is updated in the same change** —
> the contract is [`org/docs/SYNC.md`](./org/docs/SYNC.md).

| To understand… | Read |
|---|---|
| the whole system — domains, pods, end-to-end data flow | [architecture.md](./org/docs/architecture.md) |
| the on-disk format you author — a **project** or a **space** | [format/](./org/docs/format/README.md) |
| the agent runtime — turn loop, yield protocol, typecheck, forks, delegation | [runtime/](./org/docs/runtime/README.md) |
| the globals an agent can call, and the capabilities that gate them | [runtime-globals/](./org/docs/runtime-globals/README.md) |
| the `lmthing` CLI, the single-file binary and the pod REST/WS API | [cli-api/](./org/docs/cli-api/README.md) |
| the backend — gateway routes, auth, billing, LiteLLM | [cloud/](./org/docs/cloud/README.md) |
| the native clients | [desktop/](./org/docs/desktop/README.md) · [mobile/](./org/docs/mobile/README.md) |
| infra, deploy, the local stack | [devops/](./org/docs/devops/README.md) |
| making a change (add a global / space / provider / tier; testing, debugging) | [contributing/](./org/docs/contributing/README.md) |

## Getting Started

**Prerequisites:** Node.js ≥ 24 · pnpm ≥ 9 · Git (`package.json:5-7`)

```bash
git clone git@github.com:lmthing/lmthing.git
cd lmthing
git submodule update --init --recursive   # sdk/org is a submodule
pnpm install
```

### The unified web app (no backend)

```bash
cd sdk/org/apps/web && pnpm dev    # /studio, /computer and /chat are client-side routes
```

### The desktop app

```bash
cd sdk/org/apps/desktop && pnpm tauri:dev
```

### Full local stack

Ports, the `*.test` nginx proxy, demo auth and every `make` target are documented in
[`org/docs/devops/local-dev.md`](./org/docs/devops/local-dev.md).

## Repository Structure

The monorepo is organized by TLD — each lmthing.\* domain has its own top-level directory.

```
lmthing/
├── sdk/org/            # git submodule (github.com/lmthing/org) — the runtime + shared libs + the clients
│   ├── libs/           # @lmthing/{auth,cli,config,core,css,state,ui,utils}
│   ├── apps/web/       # the unified Vite SPA: /studio, /computer, /chat
│   ├── apps/desktop/   # the Tauri v2 desktop app
│   └── apps/mobile/    # the Expo / React Native app
├── cloud/              # THE backend — Hono gateway (/api/*) + LiteLLM (/v1/*)
├── org/                # lmthing.org — the docs site; org/docs/** is the source of truth
├── store/              # lmthing.store SPA + the catalog (store/projects/, store/spaces/)
├── com/ social/ space/ blog/ casa/   # product app shells (static SPAs)
├── devops/             # terraform, ansible, argocd, k8s manifests
├── app-specifications/ # worked example specs for project-apps
└── automation/         # long-running agent harnesses (not part of the product)
```

**There is no separate backend service.** `cloud/` is the sole backend; every frontend is a static SPA
that calls it. Any server-side logic — new endpoints, DB ops, webhooks — belongs in `cloud/gateway/`.

## Key Packages

| Directory | Package | Stack |
|-----------|---------|-------|
| `sdk/org/libs/core/` | `lmthing` | TypeScript · Vercel AI SDK · Zod · **QuickJS WASM** sandbox |
| `sdk/org/libs/cli/` | `@lmthing/cli` | the `lmthing` binary + the per-user pod server |
| `sdk/org/libs/state/` | `@lmthing/state` | React hooks over a virtual file system |
| `sdk/org/libs/ui/`, `libs/css/` | `@lmthing/ui`, `@lmthing/css` | shared React components · the design system |
| `sdk/org/apps/web/` | `@lmthing/web` | React 19 · Vite · TanStack Router · Tailwind 4 |
| `sdk/org/apps/desktop/` | `@lmthing/desktop` | **Tauri v2** · Rust · the same `@lmthing/ui` screens |
| `sdk/org/apps/mobile/` | `@lmthing/mobile` | **Expo / React Native** · Tamagui · OTA updates |
| `cloud/gateway/` | `@lmthing/gateway` | **Node 24 · Hono** · Stripe |

## Design system — mandatory, enforced

**Never write a raw color** in any web surface (no hex, no literal `rgb()/hsl()`, no stock Tailwind
color utilities like `gray-*`/`blue-*`). Use a design token (`var(--foreground)`, `bg-primary`, …).
Hard gate: `pnpm lint:tokens` and CI. Rules → [`org/docs/design-system/`](./org/docs/design-system/README.md).

## License

No license has been declared for this repository yet — all rights reserved by default.
