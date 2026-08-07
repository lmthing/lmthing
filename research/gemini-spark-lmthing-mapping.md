# Gemini Spark → lmthing: Deep Research, Concept & Terminology Map, Marketing Playbook, and Gap Analysis

> **Purpose.** A strategic research document that (1) deeply researches Google's **Gemini Spark**, (2) maps its concepts and terminology onto **lmthing**, (3) documents how Spark is marketed, (4) lays out a full plan to adopt Spark's concepts, terms and marketing on lmthing, and (5) reports the features lmthing is missing.
>
> **Method note.** Gemini Spark facts are drawn from public reporting and Google help pages gathered via web search (August 2026). lmthing facts are grounded in this repo — every lmthing claim carries a `path:Lstart-Lend` or `path#Symbol` citation, per [`org/docs/SYNC.md`](../org/docs/SYNC.md). Sources are listed at the end.
>
> **Status of this document.** Strategy/marketing analysis, not a source-of-truth doc. It intentionally lives in `research/` (not `org/docs/`) so it is outside the `docs:check` citation gate.

---

## 0. Executive summary

**Gemini Spark** is Google's "24/7 personal AI agent," announced at Google I/O 2026. It reframes Gemini from a chatbot you open-and-close into a *persistent, proactive agent* that runs on dedicated cloud VMs, acts across your apps on your behalf, and asks for approval before sensitive actions. Its user model is three nouns — **Tasks** (what), **Schedules** (when), **Skills** (how) — plus **Connections** (Google Workspace, third-party services, and any custom app via an **MCP server URL**), a **Skills Library** of 50+ starter skills, and a forthcoming **Skills Marketplace**.

Structurally, **lmthing is already a superset of Spark's architecture** — a per-user cloud pod, an agentic harness, background automation, an install-from-catalog store, connections, and human consent gating — but with two things Spark does *not* have: an execution model where **the model writes TypeScript instead of calling tools**, and a **portable, git-ownable "agent is a folder" format** that also **builds you a whole application (schema + API + UI), not just an automation.**

The strategic opportunity: **Spark has spent Google's marketing budget teaching the whole market a vocabulary — "24/7 agent," "Tasks/Skills/Schedules," "under your direction," "from prompting to delegation."** lmthing can ride that vocabulary (mapping its own richer primitives onto the terms buyers now recognize) while differentiating on the two axes Google structurally can't match: **openness/ownership** ("agents are files you own," "your workspace is a git repo," "install as files you can edit") and **it builds real apps, not just task automations.**

The gaps lmthing must close to be credible against Spark's *demoed* experience are mostly **proactivity, ambient presence, and turn-key connectors**: always-on triggered proactivity out of the box, first-class Gmail/Calendar/Docs connectors, a mobile "ambient status" surface, a populated starter-skill/app library, and a public marketplace. These are covered in §8.

---

# PART I — DEEP RESEARCH ON GEMINI SPARK

## 1. What Gemini Spark is

Gemini Spark is a **persistent, agentic personal assistant** unveiled at **Google I/O 2026** (announced May 19–20, 2026). Sundar Pichai framed it as "the next evolution of smart digital assistants," using agentic AI to take on **long-horizon tasks with minimal oversight**. Google's own line: a "24/7 AI agent that helps you navigate your digital life, takes action on your behalf and is **under your direction**."

The central reframe is **persistent + proactive**, not open-and-close + reactive:

- **Persistent:** Unlike a chatbot tab you close, Spark "runs on dedicated virtual machines on Google Cloud and keeps working in the background even when you close your laptop or lock your phone." A task "is not tied to your device's session lifecycle."
- **Proactive:** "It reads your incoming email and flags what needs action. It drafts replies, schedules, and follow-ups **before you ask**." The positioning contrast Google draws: standard chatbots wait for a prompt; Spark takes action on your behalf.

## 2. Architecture (as reported)

Three layers:

1. **Model foundation** — **Gemini 3.5 Flash** (the reporting also references Gemini 3.5 generally).
2. **Agent harness** — Google's **Antigravity** platform. The harness "wraps Gemini model calls with infrastructure for goal persistence, task decomposition, tool orchestration, safety constraints, and state recovery," and "enables **parallel sub-agent execution** — a single Spark task can spin up multiple specialized sub-agents working simultaneously."
3. **Execution infrastructure** — **Google Cloud VMs**. "Every background task executes within a fresh, strictly isolated, ephemeral virtual machine on Google Cloud," providing "enterprise-grade security and DLP without local infrastructure management." The agent "stays online continuously" as "a persistent runtime."

## 3. The user-facing model: Tasks, Schedules, Skills, Connections

Google's mental model is **three building blocks — the *what*, the *when*, and the *how***:

- **Tasks (the *what*)** — "your high-level goal … a complete project or objective you want Gemini Spark to manage for you." Example: *"Plan and manage my business trip to London."*
- **Schedules (the *when*)** — "hand over tasks to Gemini Spark so they run automatically in the background by telling Gemini what to do and when to do it," either at a specific date/time **or in response to an event**.
- **Skills (the *how*)** — "a saved set of reusable instructions and context that teaches Gemini how to complete a specific type of work and which tools to use." Once a skill is active, "Spark can apply it **automatically when a task matches**." Skills are **composable** ("Skills can reference other Skills") and **multiple skills can serve one task**.

Supporting systems:

- **Skill Builder + Skills Library** — you "create your first Skill in the Skill Builder, or pick from **50+ starter Skills** in the library" (summarize a YouTube video, compare products, analyze an ingredient label, etc.). "Every skill is a free template."
- **Connections / Connected Apps** — out-of-the-box **Google Workspace** (Gmail, Calendar, Docs, Sheets, Slides) and **third-party services** (OpenTable, Instacart). Plus **custom apps**: "add any custom app with its **Model Context Protocol (MCP) server URL**" in Connected Apps settings.
- **Memory / Personal Intelligence** — "learns from your behavior"; "Personal Intelligence" connects Google apps for personalized experiences. (Reported caveat: **no native persistent cross-session memory** yet — third-party MCP memory servers fill the gap.)
- **Consent / "under your direction"** — human-in-the-loop checkpoints. "Spark requires approval before carrying out sensitive actions such as sending emails or spending money"; on a web task reaching a payment step it "hands control back to you." Requires **"Keep Activity" on**; ships with **prompt-injection protections**.
- **Ambient status (Android "Halo")** — a lightweight top-of-screen signal showing which tasks are running, done, or need approval (rolling out later in 2026).
- **Desktop + Chrome** — Mac desktop client adds **local files, MCP, real-time tracking**; **Chrome "Auto Browse"** integration lets Spark drive the browser.
- **Enterprise Skills Marketplace** — a hub for Business/Enterprise to "discover, share, and deploy AI capabilities across their workflows" (in development).

## 4. Availability & pricing

- Launched **May 2026** on **Google AI Ultra** ($100–$200/mo), then expanded (July 2026) to **Google AI Pro** ($20/mo) in the US, rolling out to more countries "soon." Excluded regions at Ultra launch reportedly include the EEA, Switzerland, UK, and Nigeria.
- 900M+ monthly Gemini App users and deep Workspace integration are the stated distribution advantage.

## 5. Competitive framing (as reported)

Spark is positioned as Google's answer to **OpenClaw** (a fast-rising open-source, self-hosted personal agent — "300,000 GitHub stars"), and against **Anthropic's Claude Cowork** and **OpenAI's ChatGPT Agent**. The analyst framing: the products "split on one variable: **who holds the runtime.**" Google "owns the runtime, the context, and the upgrade path," targeting **median users with frictionless, Workspace-native onboarding**; OpenClaw targets **developers and the privacy-sensitive** who want credentials on their own hardware.

> **Note for lmthing:** on the "who holds the runtime" axis, **lmthing sits closer to the open/ownership pole than Google** (per-user pod, files you own, git repo, install-as-editable-files) **while still being hosted and frictionless** — the exact seam between Spark and OpenClaw. That is the wedge.

## 6. One clarification: app-building ≠ Spark

Spark automates workflows; it does **not** generate full applications. Google's *app-creation* story is a **separate product**, **Gemini for App Creation in AppSheet** ("describe a business process; AppSheet returns tables, columns, views and actions"). This split matters: **lmthing's "describe an app, get an app with a real backend" has no direct Spark equivalent** — it competes with AppSheet, and it's a differentiator to press (§9).

---

# PART II — CONCEPT & TERMINOLOGY MAPPING

## 7. Concept mapping (Spark concept → lmthing mechanism)

| Gemini Spark concept | lmthing equivalent | Grounding |
|---|---|---|
| **Persistent 24/7 agent** ("keeps working when your laptop is closed") | **Per-user compute pod** — a private single-tenant runtime per logged-in user; **scales to zero, cold-wakes in ~1s**; runs background hooks/events | `org/docs/architecture.md:106-120`; `lmthing/README.md:189-196` |
| **Antigravity harness** (goal persistence, task decomposition, tool orchestration, safety, state recovery) | **The turn/eval loop + QuickJS WASM sandbox** — model streams TypeScript one statement at a time; host typechecks, evaluates, and re-prompts with a `VARIABLES` block | `org/docs/runtime/turn-loop.md:1-10`; `org/docs/runtime-globals/README.md:1-9` |
| **Parallel sub-agent execution** | **`fork()` + `tasklist()` DAGs + `delegate()`** — headless sub-agents, host-driven DAG workflows, and delegation to narrower specialists | `org/docs/runtime-globals/README.md:274-277`; `org/docs/system-spaces/README.md:208-210` |
| **Ephemeral isolated VM per background task on Google Cloud** | **Worker-isolated execution + the pod's k8s namespace** (`user-<id>`); api handlers are worker-isolated Node; the sandbox is a per-VM QuickJS instance | `org/docs/app/README.md:93-104`; `org/docs/architecture.md:106-120` |
| **Task (the *what*)** — a high-level goal Spark manages | **Session + `tasklist()`** — a THING session pursues a goal; a **tasklist** is a named DAG that resolves a `TaskEnvelope` | `org/docs/runtime-globals/README.md:275`; `org/docs/system-spaces/README.md:208-210` |
| **Schedule (the *when*)** — run at a time or on an event | **Events + hooks** — `events/*` emitter defs (`webhook`/`cron`/`db`/`internal`) and `hooks/` consumers (`cron`/`event`/`webhook`); `emitEvent()` | `org/docs/format/project/README.md:1-31`; `org/docs/runtime-globals/README.md:284` |
| **Skill (the *how*)** — reusable instructions + context + which tools to use, auto-applied when relevant, composable | **Space / agent** — "an agent is a folder": `charter.md` + `instruct.md` frontmatter wiring (`functions`, `knowledge`, `components`, `actions`, `capabilities`, `triggers`); spaces compose via `delegate()` | `org/docs/format/space/README.md:11-64`; `lmthing/README.md:33-70` |
| **Skill Builder** — UI to author a skill | **`system-architect` ("the meta-agent that builds other agents")** via `synthesize_and_run`; and hand-authoring in **/studio** | `org/docs/system-spaces/README.md:43,260-277`; `org/docs/studio/README.md:1-8` |
| **Skills Library (50+ starter skills)** + **Skills Marketplace** | **The store** — a catalog SPA (`store/`) over `{apps[], spaces[]}`; `installSpace()` / `POST /api/apps/install`; "arrive as files you own and can edit" | `org/docs/README.md:77-97`; `org/docs/architecture.md:139-142` |
| **Connections / Connected Apps** (Workspace + third-party) | **Connections + `callConnection(provider, req)`** — authenticated request via the gateway egress proxy; **token never enters the sandbox** | `org/docs/runtime-globals/README.md:284-286` |
| **Custom app via MCP server URL** | **Integration spaces as event sources + `callConnection`** (lmthing's extension seam; MCP-ingest is a gap — see §8) | `org/docs/format/space/events/README.md`; `org/docs/runtime-globals/README.md:284-286` |
| **Memory / Personal Intelligence** ("learns your behavior") | **`user-memory` space** (`remember`/`recall`/`recallAll`/`forget`) — durable facts about the user | `org/docs/system-spaces/README.md:54` |
| **"Under your direction" / approval before sensitive actions** | **Consent cards + the capability gate** — consent-marked yields render a fail-closed consent card; **capabilities, not permissions**: an ungranted power is absent from injection *and* the DTS | `org/docs/runtime-globals/store-and-consent.md:118-190`; `org/docs/runtime-globals/README.md:79-103` |
| **Prompt-injection protections** | **Capability-by-construction + typecheck-in-the-loop** — a stray call fails typecheck (retryable), never executes; ungranted powers don't exist in the agent's world | `org/docs/runtime/typecheck.md`; `org/docs/runtime-globals/README.md:79-103` |
| **Ambient status ("Halo")** | **`setActivity()` live status + WS trace + consent cards in /chat** (no dedicated mobile ambient surface yet — gap §8) | `org/docs/runtime-globals/README.md:273`; `org/docs/chat/README.md:1-3` |
| **Chrome "Auto Browse" / Mac local files** | **`system-browser`/`system-desktop-browser` + desktop app (Tauri) + `fs:scratch` (engineer)** | `org/docs/system-spaces/README.md:46-48`; `lmthing/README.md:112-134` |
| **Skills Marketplace (enterprise share/deploy)** | **The store's spaces catalog + team pods** (public marketplace + ratings is a partial gap — §8) | `org/docs/product-spas/README.md:176-207` |
| **Workspace-native distribution (900M users)** | **The fleet of SPAs + email sign-in + free-tier pod** (distribution is lmthing's weakest axis vs Google — §8) | `org/docs/architecture.md:69-85` |
| **(No Spark equivalent) — full app generation** | **project-as-application** — `createProject` → automator builds schema + typed API + spec UI + hooks, served at a clean URL on lmthing.app | `lmthing/README.md:85-93`; `org/docs/runtime-globals/app-authoring.md:20-58` |

## 8-terms. Terminology mapping (Spark word → lmthing word)

Use this as the **Rosetta table**: keep lmthing's precise internal terms in the docs, but *speak Spark's nouns* in marketing so buyers map instantly.

| Gemini Spark term | Closest lmthing term(s) | Notes on the mapping |
|---|---|---|
| **Agent** ("your 24/7 agent") | **THING** (the super-agent) / **agent** (a space's specialist) | lmthing has a *named* hero agent (THING) that also **builds other agents** — a stronger character than "Spark." |
| **Task** | **session goal** / **tasklist** | Spark's "Task" = lmthing's "what I asked THING to do"; the durable multi-step form is a **tasklist DAG**. |
| **Schedule** | **event / hook (cron·webhook·db·internal)** | lmthing's trigger surface is broader (DB-change and internal events, not just clock/inbox). |
| **Skill** | **space** / **agent** ("an agent is a folder") | lmthing's unit is richer: instructions **+ knowledge + functions + components + tasklists + events** in one git-diffable folder. |
| **Skill Builder** | **architect** / **/studio** | "The meta-agent that builds other agents" + a hand-editing IDE. |
| **Skills Library / Starter Skills** | **store catalog (spaces)** | Need a *populated* starter set to match Spark's 50+ (gap §8). |
| **Skills Marketplace** | **lmthing.store** | Add ratings/publishing polish (partial gap). |
| **Connection / Connected App** | **connection** / **`callConnection`** / **integration space** | Same concept; lmthing keeps the **token out of the sandbox**. |
| **MCP server URL (custom app)** | **integration space / connection** (MCP-ingest = gap) | Adopt "connect any app" language; build MCP-ingest to make it literally true. |
| **Memory / Personal Intelligence** | **memory space (`remember`/`recall`)** | lmthing already ships durable memory as a first-class space. |
| **"Under your direction"** | **consent card / capability gate** | lmthing's version is stronger: *capabilities, not permissions.* |
| **Antigravity (the harness)** | **the runtime** ("the model writes TypeScript") | Don't market the harness name; market the *execution model* — it's the differentiator. |
| **Task Scheduler / background run** | **pod + events + scale-to-zero** | "Costs nothing while you are away" is a sharper version of the same promise. |
| **Halo (ambient status)** | **`setActivity` / live trace** | Needs a mobile ambient surface to match (gap §8). |
| **Auto Browse** | **browser / desktop-browser spaces** | Parity concept; ensure it's demoable. |

---

# PART III — HOW GEMINI SPARK IS MARKETED

## 9. Marketing report

### 9.1 The one-line promise
**"Gemini Spark — your 24/7 personal AI agent for productivity."** Reinforced everywhere by the triad: *helps you navigate your digital life · takes action on your behalf · **under your direction**.*

### 9.2 The core narrative arc ("from prompting to delegation")
Every piece of Google's copy runs the same three-beat story:
1. **Old world:** a chatbot you open, prompt, and close; it only reacts.
2. **New world:** an agent that **persists** (works while your devices are off) and is **proactive** (reads your email, flags actions, drafts before you ask).
3. **The shift:** *"from prompting to delegation"* — Gemini goes from "an assistant that answers questions" to "an active partner that does real work on your behalf."

### 9.3 The pillars Google leads with
- **Always-on / 24/7** — the headline adjective; repeated in nearly every title.
- **Proactive** — the differentiator vs prior AI ("acts before you ask").
- **Under your direction / safe** — approval checkpoints, prompt-injection defense, "you stay in control." De-risks "autonomous."
- **Effortless / native** — out-of-the-box Workspace connections, "zero setup," frictionless onboarding; leans on 900M users.
- **Extensible** — Skills, a Skills Library "starter pack," custom apps via MCP.
- **Enterprise-ready** — ephemeral isolated VMs, DLP, a Skills Marketplace for orgs.

### 9.4 Structure & packaging as marketing
Google turned the *architecture* into a **memorable three-noun mnemonic — Tasks / Schedules / Skills = what / when / how.** This is the single most copyable marketing move: it makes an agent platform learnable in one sentence.

### 9.5 Channel & motion
Big-stage launch (**I/O 2026 keynote**) → tiered rollout as scarcity (**Ultra first, then Pro**) → a steady drumbeat of feature updates (Chrome Auto Browse, Mac client, Android Halo) → a **starter library** to remove the blank-page problem → developer content (dev.to guides, "inside the code" pieces) to seed an ecosystem.

### 9.6 Competitive posture
Explicitly the "**safe, integrated, hosted**" option vs the "**self-hosted, DIY, privacy-max**" OpenClaw and vs ChatGPT Agent / Claude Cowork. The whole argument reduces to **who holds the runtime**.

---

# PART IV — THE PLAN: ADOPT SPARK'S CONCEPTS, TERMS & MARKETING ON lmthing

The plan has three tracks — **Vocabulary**, **Product/Concept parity**, **Marketing/GTM** — sequenced in phases. Each item names the concrete lmthing surface to touch.

## 10. Track A — Adopt the vocabulary (fastest, highest leverage)

Speak the words the market already learned from Google, mapped onto lmthing's richer primitives. **Copy edits only — no engine changes.**

1. **Lead with "your 24/7 agent."** Put an always-on line on the hero. lmthing's pod already *is* 24/7 (scale-to-zero + event wake). Reframe existing copy in `com/src/routes/index.tsx:318-322` to foreground persistence + proactivity, not just "build."
2. **Adopt the three-noun mnemonic.** Introduce a public "**Ask · Automate · Build**" (or map directly to **Tasks · Schedules · Skills**) triad as lmthing's learnable model. lmthing can *out-triad* Spark because it adds **Build** (real apps) as a fourth pillar Spark lacks.
3. **Say "Skills" out loud, keep "space" as the technical term.** Marketing surface: "install a **Skill**"; docs/runtime: "space." Add a one-line Rosetta in the store: *"Skills in lmthing are folders you own."*
4. **Adopt "under your direction."** Rebrand the consent-card/capability story with Spark's exact phrase, then top it: *"Under your direction — and by construction. Ungranted powers don't just get denied; they don't exist in the agent's world."* (`org/docs/runtime-globals/README.md:79-103`)
5. **Adopt "from prompting to delegation."** It's literally what THING does — it **forks and delegates**. Use it verbatim as a section header.
6. **Name the proactive story.** Coin a lmthing term for triggered/proactive runs (e.g. "**Watchers**" or reuse "**Schedules**/**Events**") and give it hero billing.

## 11. Track B — Concept/product parity (close the demoable gaps)

Ordered by marketing impact ÷ effort.

1. **Ship first-party Gmail/Calendar/Docs connectors** as installable integration spaces (the single biggest Spark demo advantage). Mechanism exists (`callConnection`, integration spaces); the work is *building the connectors + OAuth*. → `org/docs/runtime-globals/README.md:284-286`.
2. **Populate a "Starter Skills / Starter Apps" library** in the store to beat the blank page — mirror Spark's "50+ starter skills." lmthing can ship **starter Apps** (recipe planner, trip organiser, health tracker — already the README's examples, `lmthing/README.md:85-93`) *and* starter Spaces.
3. **Proactivity out-of-the-box.** Ship pre-wired **event/cron hooks** ("watch my inbox," "every morning") as one-click installs so proactivity is a default, not a build task. Engine exists (`events/`, `hooks/`); package the UX.
4. **MCP ingest.** Make "**connect any app via MCP**" literally true by adding an MCP-client seam alongside `callConnection`/integration spaces. This directly matches Spark's custom-app pitch and future-proofs the connector story.
5. **Mobile ambient status.** A lightweight "what your agents are doing / needs approval" surface on the phone app to match **Halo**. `setActivity` + WS trace already feed it (`org/docs/runtime-globals/README.md:273`).
6. **Store polish → Marketplace.** Add publishing flow, ratings, and org-shared catalogs (team pods) to match the "Skills Marketplace" narrative. → `org/docs/product-spas/README.md:176-207`.
7. **Finish the scaffold SPAs or stop marketing them.** `social/team/blog/casa` are documented scaffolds (`org/docs/product-spas/README.md:9-13`); either build the one that matters (team) or keep copy honest.

## 12. Track C — Marketing / GTM motions to copy

1. **A memorable model page.** Build a "How lmthing works" page around the triad, exactly like Spark's Tasks/Skills/Schedules explainer — but with the **Build** pillar as the finale ("…and it ships you a real app").
2. **Tiered launch as scarcity.** lmthing already has "start free, paid from $10/mo" (`com/src/routes/index.tsx:618-622`). Add a marquee "founding/pro" tier and a launch moment.
3. **Feature drumbeat.** Publish a cadence: connector of the week, starter-app of the week, "inside the runtime" dev posts (lmthing's "model writes TypeScript" is *genuinely* more interesting technical content than Antigravity).
4. **Own the seam Spark can't.** Anchor positioning on **ownership + openness + real apps**: "**Your agents are files you own. Your workspace is a git repo. And it builds you a real app, not just a to-do runner.**" This is the OpenClaw wedge *without* the setup tax.
5. **Comparison content.** Publish an honest "lmthing vs Spark vs OpenClaw" table centered on "who holds the runtime" — lmthing = hosted *and* ownable.
6. **Fix the licensing optics.** The repo currently declares **no license (all-rights-reserved by default)** while marketing says "**open platform**" (`lmthing/README.md:307-309`). Before leaning hard on "open," either add an OSS license or soften the word. This is a credibility landmine against an audience that just watched OpenClaw win on openness.

## 13. Phasing

- **Phase 0 (days):** Track A copy edits (hero, triad, "under your direction," "prompting→delegation," Rosetta line). Resolve the "open" licensing wording. Zero engine risk.
- **Phase 1 (weeks):** Gmail/Calendar/Docs connectors; a real Starter Apps + Starter Skills library; pre-wired proactive hooks; the "How it works" model page.
- **Phase 2 (quarter):** MCP ingest; mobile ambient status; store→marketplace (publishing, ratings, team catalogs); comparison content and launch moment.

---

# PART V — GAP ANALYSIS (what lmthing is missing vs Spark)

## 14. Features Spark has that lmthing lacks or under-delivers

| # | Spark capability | lmthing status | Severity | Closing move |
|---|---|---|---|---|
| 1 | **First-party Workspace connectors (Gmail/Calendar/Docs) out of the box** | Mechanism exists (`callConnection`, integration spaces) but **no shipped first-party connectors** | **High** (biggest demo gap) | Build + OAuth the top 3 connectors as installable spaces |
| 2 | **Default proactivity** ("reads your email, flags actions before you ask") | Engine exists (`events/`, `hooks/`, cron) but proactivity is **something you build**, not a default | **High** | Ship pre-wired one-click "watchers"/schedules |
| 3 | **Populated starter library (50+)** | Store exists; **catalog is thin** | **High** | Seed 20–50 starter Apps + Spaces |
| 4 | **"Connect any app via MCP"** | No MCP-client ingest seam | **Medium** | Add MCP-client alongside `callConnection` |
| 5 | **Mobile ambient status (Halo)** | `setActivity`/trace exist; **no dedicated mobile ambient UI** | **Medium** | Lightweight phone status surface |
| 6 | **Public marketplace polish (publish, ratings, org share)** | Store is browse+install; **no publish/ratings flow** | **Medium** | Publishing + ratings + team catalogs |
| 7 | **Mass distribution / brand reach** (900M Gemini users, Workspace default) | lmthing has email sign-in + free pod but **no distribution moat** | **High (structural)** | Lean on ownership/openness niche + developer ecosystem; can't out-distribute Google |
| 8 | **Turn-key "zero setup" perception** | Free pod is close, but connectors/keys still needed | **Medium** | Bundle keys/free-tier so first task runs with zero config |
| 9 | **Enterprise trust signals (DLP, isolated VM messaging, compliance)** | Pods are isolated but **compliance/DLP story isn't marketed** | **Medium** | Publish a security/isolation page |
| 10 | **Named, characterful "agent" brand** | lmthing has **THING** (arguably stronger) but under-marketed | **Low** | Make THING the marketing protagonist |
| 11 | **Scaffolded surfaces sold as shipped** | `social/team/blog/casa` are scaffolds (`org/docs/product-spas/README.md:9-13`) | **Low/credibility** | Build team or trim copy |

## 15. Where lmthing is already ahead (press these)

1. **Execution model.** *"The model writes TypeScript, not tool calls."* Real control flow in one turn; a **typechecker in the loop** ("caught in the writer, not at 2am in production"); safety by construction. No Spark equivalent. (`lmthing/README.md:15-31`)
2. **Ownership & portability.** *"An agent is a folder"* you can read, diff, git-commit, publish, and install as **files you own and can edit**. Spark's skills live inside Google. (`lmthing/README.md:33-70`; `com/src/routes/index.tsx:408-415`)
3. **It builds real apps, not just automations.** *"Describe an app, get an app — schema, typed API, UI — at its own URL, with your data inside."* Spark punts app-building to AppSheet. (`lmthing/README.md:85-93`)
4. **Capabilities, not permissions.** Ungranted powers are absent from the agent's world *and its types* — a stronger safety story than "asks for approval." (`org/docs/runtime-globals/README.md:79-103`)
5. **Cost model.** *"Costs nothing while you are away"* (scale-to-zero) + *"budgets, not surprise bills."* (`lmthing/README.md:189-196`; `com/src/routes/index.tsx:243-282`)
6. **True multi-surface sameness.** Same code on web, desktop (Tauri) and phone (Expo) + a single-file CLI runtime. (`lmthing/README.md:112-161`)
7. **Hosted *and* ownable** — occupies the seam between Spark (hosted, closed) and OpenClaw (open, DIY setup tax).

---

## 16. Sources

**Gemini Spark (web, Aug 2026):**
- Google blog — "The Gemini app becomes more agentic…": https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/
- Gemini Spark overview: https://gemini.google/overview/agent/spark/
- TechCrunch — "Google introduces Gemini Spark…": https://techcrunch.com/2026/05/19/google-introduces-gemini-spark-a-24-7-agentic-assistant-with-gmail-integration/
- DataCamp — "Gemini Spark: Google's Always-On AI Agent Explained": https://www.datacamp.com/blog/gemini-spark
- MindStudio — "What Is Gemini Spark?": https://www.mindstudio.ai/blog/what-is-gemini-spark-google-24-7-agent
- Forbes — "Inside Gemini Spark: Code Reveals The Skill System And Task Scheduler": https://www.forbes.com/sites/paulmonckton/2026/05/16/inside-gemini-spark-code-reveals-the-skill-system-and-task-scheduler-powering-googles-ai-agent/
- AI Agents Library — Tasks/Skills/Schedules: https://www.aiagentslibrary.com/blog/gemini-spark-tasks-skills-schedules/ ; Skills guide: https://www.aiagentslibrary.com/blog/how-to-create-a-gemini-spark-skill/ ; best skills: https://www.aiagentslibrary.com/blog/best-gemini-spark-skills/
- aidatainsider — "Google I/O 2026: Gemini 3.5 Flash, Antigravity and Managed Agents": https://aidatainsider.com/ai/google-i-o-2026-gemini-3-5-flash-antigravity-and-managed-agents-explained/
- Google support — Skills: https://support.google.com/gemini/answer/17094296 ; Custom apps (MCP): https://support.google.com/gemini/answer/17209137 ; Tasks/workflows: https://support.google.com/gemini/answer/17094507
- TechRepublic — app connections: https://www.techrepublic.com/article/news-gemini-spark-app-integrations/
- Hindsight/Vectorize — persistent memory over MCP: https://hindsight.vectorize.io/blog/2026/06/15/gemini-spark-persistent-memory
- TechTimes — Mac client (local files, MCP): https://www.techtimes.com/articles/319536/20260702/gemini-spark-lands-mac-local-files-mcp-real-time-tracking-join-desktop-ai-battle.htm
- 9to5Google — AI Pro rollout: https://9to5google.com/2026/07/23/gemini-spark-google-ai-pro-us/
- Digital Trends — Pro-tier expansion: https://www.digitaltrends.com/computing/gemini-spark-is-no-longer-restricted-to-googles-priciest-ultra-tier/
- Technology.org — Spark vs OpenClaw: https://www.technology.org/2026/05/26/gemini-spark-vs-openclaw-deep-comparison-2026/
- AppSheet Help — Gemini for App Creation: https://support.google.com/appsheet/answer/14699210
- CryptoBriefing — Skills Marketplace: https://cryptobriefing.com/google-skills-marketplace-gemini-enterprise/

**lmthing (this repo):** `lmthing/README.md`; `com/src/routes/index.tsx`; `org/docs/architecture.md`; `org/docs/README.md`; `org/docs/runtime-globals/README.md`; `org/docs/runtime-globals/app-authoring.md`; `org/docs/runtime-globals/store-and-consent.md`; `org/docs/runtime/turn-loop.md`; `org/docs/runtime/typecheck.md`; `org/docs/format/space/README.md`; `org/docs/format/project/README.md`; `org/docs/system-spaces/README.md`; `org/docs/{chat,studio,computer}/README.md`; `org/docs/product-spas/README.md`; `org/docs/app/README.md`.
