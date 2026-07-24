# Shared projects — multi-user access to one lmthing project

**Status: research / design proposal. Nothing described in "What must be built" exists today.**

This document answers: *what is needed so a user can share a project with other lmthing users, who
then use it with their own accounts — some read-only (use the spaces and the app, but change
nothing), some with write access (edit the project)?*

Part 1 is grounded in the current code (every claim cited). Parts 2–6 are design.

> Convention: `org/docs/` is the source of truth for what **is**. This file is deliberately outside
> it because it describes what **isn't** yet. When any of this ships, the facts move into
> `org/docs/` per [`org/docs/SYNC.md`](../org/docs/SYNC.md) and the corresponding section here is
> deleted.

---

## Part 1 — Where we are today

### 1.1 There is no sharing model anywhere in the system

- No membership, ACL, role, invite, or share table exists in the gateway's Postgres schema. The
  gateway's own tables are `profiles`, `sso_codes`, `backup_config`, `user_cron_jobs`,
  `webhook_bindings`, `controller_ticks` (`cloud/gateway/src/lib/db.ts#ensureSchema`;
  `cloud/migrations/001..009`).
- No gateway route grants or checks access to another user's resources. The full route table is
  auth / keys / billing / stripe-webhook / compute / backup / inbound / status / issues
  (`cloud/gateway/src/index.ts:28-38`, documented in `org/docs/cloud/routes.md`).
- `lmthing.team` — the surface where this would naturally live — is an empty route scaffold: "There
  is no room backend, no shared VFS and no membership model" (`team/README.md`).
- The pod's project API has no owner, ACL or visibility field. `ProjectMeta` is
  `{ id, name, createdAt }` (`sdk/org/libs/cli/src/server/projects.ts#ProjectMeta`).

So this is a greenfield feature, not an extension of something half-built.

### 1.2 The architectural fact that dominates everything: identity **is** the tenancy boundary

lmthing is not a multi-tenant application with a shared database. It is **one single-tenant runtime
per user**, and the user's identity is literally the routing key to their runtime. Four independent
layers all assume "the caller is the owner", and each of them has to change.

**Layer 1 — Edge routing derives the destination pod from the JWT subject.**
Envoy validates the gateway-issued HS256 JWT and maps the `sub` claim to an `x-user-id` header
(`devops/argocd/envoy/chat-policies.yaml:118-139`, and the identical `studio-`/`computer-`/`app-`
policies). A Lua filter then builds the upstream from it:

```lua
local user_id = request_handle:headers():get("x-user-id")
local upstream = "lmthing.user-" .. user_id .. ".svc.cluster.local:8080"
```
(`devops/argocd/envoy/chat-policies.yaml:26-44`)

There is no authorization step — no `ext_authz`, no policy lookup. **Who you are** and **which pod
you reach** are the same value. A guest presenting their own valid JWT is routed to *their own*
empty pod; there is no way to express "route me to Alice's pod".

**Layer 2 — The pod has no authentication at all.**
"The pod server has no authentication of its own. There is no token check and no auth middleware"
(`org/docs/cli-api/rest/README.md`, grounded at `sdk/org/libs/cli/src/server/serve.ts:L343-L370`).
Reaching the pod's port *is* full authority. That is safe today only because the pod's network
position guarantees the sole caller is the owner. Concretely, anyone who reaches the pod gets:

| Surface | What it grants | Citation |
|---|---|---|
| `WS /api/terminals/:termId` | An interactive **shell** with cwd = the pod runtime root | `sdk/org/libs/cli/src/server/ws/terminal.ts#handleTerminalWsUpgrade` |
| `GET/PUT /api/fs/*` | Read/write **any file** under the runtime root | `sdk/org/libs/cli/src/server/routes/fs.ts` |
| `GET/PUT /api/env` | Read and replace the pod `.env` — **every API key and secret** | `sdk/org/libs/cli/src/server/routes/env.ts#handleEnvPut` |
| `GET /api/projects` | **Every** project on the pod, not a filtered set | `sdk/org/libs/cli/src/server/projects.ts#listProjects` |
| `DELETE /api/projects/:id` | Delete any project except `user`/`system` | `sdk/org/libs/cli/src/server/routes/projects.ts#handleDeleteProject` |
| `PUT .../spaces/:id/files` | **Wipe-and-rewrite** a whole space directory | `sdk/org/libs/cli/src/server/routes/projects.ts#handlePutProjectSpaceFiles` |
| `POST /api/restart` | Kill the process | `sdk/org/libs/cli/src/server/serve.ts:143-147` |
| `GET /api/session-ledger`, `GET /api/hooks` | Pod-global session/cost history and every hook | `sdk/org/libs/cli/src/server/routes/session-ledger.ts`, `.../hooks.ts` |

**Any sharing design that lets a second person's traffic reach the pod must first give the pod an
auth layer.** This is the single largest work item, and it is a prerequisite, not a follow-up.

**Layer 3 — One pod, one LiteLLM key, one payer.**
The gateway fetches the owner's LiteLLM virtual key and injects it into the pod's `user-env` secret
at create time (`cloud/gateway/src/lib/compute.ts:583-600`, via `getLiteLLMKey` at `:312` and
`litellmEnvDefaults` at `:343`). The runtime has no notion of a
per-request key. **Every token a guest causes to be spent is billed to the owner**, against the
owner's tier budget windows (`org/docs/cloud/billing-and-tiers.md`). Pod size is also the owner's
tier's (`cloud/gateway/src/lib/tiers.ts`), and concurrent sessions are capped pod-wide at
`MAX_SESSIONS`, default 24 (`sdk/org/libs/cli/src/server/session-manager.ts:296`).

**Layer 4 — The project-app runtime has no request identity whatsoever.**
The app API dispatch is `runtime.handle(method, path, input)` — no principal, no headers, no session
(`sdk/org/libs/cli/src/server/routes/app-api.ts:53`). The Envoy comment states it outright: "A
project-app is SINGLE-USER and has no auth of its own — the only auth here is the PLATFORM picking
which pod" (`devops/argocd/envoy/app-policies.yaml:1-9`). So "let a guest *use* the app" currently
means "let a guest use it as if they were the owner, with no per-user data separation".

### 1.3 A project is a directory, not an addressable object

A project is `<root>/<projectId>/` on the owner's 1Gi PVC — `project.json`, `instructions.md`,
`documents/`, `spaces/`, `sessions/`, plus the app pillars `database/ api/ pages/ hooks/
components/ events/` (`org/docs/cli-api/rest/projects.md`, `org/docs/format/project/README.md`).
Its SQLite database is `<project>/.data/app.db` (`sdk/org/libs/cli/src/app/store.ts`). Nothing about
it is reachable from outside the owning pod, and nothing in it records who may touch it.

Notably, **agent sessions live inside the project** — `<root>/<projectId>/sessions/` and
`<root>/<projectId>/spaces/<spaceId>/sessions/` (`sdk/org/libs/cli/src/server/projects.ts#sessionsDir`,
`#spaceSessionsDir`). If a guest chats with a shared project's agent, that conversation is persisted
into the owner's project directory and is listed by `GET /api/projects/:id/sessions` for everyone
with access. That is a privacy decision that must be made explicitly, not inherited.

### 1.4 Existing primitives worth reusing

None of these is sharing, but each solves a sub-problem and establishes a pattern to copy:

| Primitive | Why it's relevant |
|---|---|
| **Audience-scoped JWTs** — `signComputeToken`/`signBackupToken`/`signInboundToken`, `aud`-pinned, verified per-route, subject is authoritative (`cloud/gateway/src/lib/tokens.ts:56-194`) | Exactly the shape a *grant token* needs: a gateway-minted, narrowly-scoped credential whose claims the data plane trusts. |
| **The inbound broker** — a public per-user URL where the gateway verifies a token, wakes the pod, and forwards into it (`cloud/gateway/src/routes/inbound.ts:113-157`) | A working precedent for *someone who is not the owner* reaching an owner's pod through the gateway, including the pod-wake dance. |
| **Store install** — `POST /api/apps/install`, `POST /api/store/spaces/install`, with a pristine-vs-diverged hash guard (`sdk/org/libs/cli/src/server/routes/apps.ts#handleInstallApp`) | The transport for *copy*-flavoured sharing, and the divergence-detection logic a sync-based design would need. |
| **GitHub backup** — the whole workspace pushed to a repo via a gateway-minted, repo-scoped App token (`cloud/gateway/src/routes/backup.ts`) | A ready-made replication channel if sharing is implemented as copy-and-sync rather than live access. |
| **Capabilities** — 14 grant ids gating every write global, driving *both* injection and the typecheck DTS, so an ungranted call fails typecheck rather than throwing (`sdk/org/libs/core/src/spaces/capabilities.ts#CAPABILITY_IDS`, `sdk/org/libs/core/src/exec/bootstrap.ts:L99`) | The only place read-only can be enforced *for agent execution*. HTTP-level read-only is not enough — see §3.4. |
| **`x-user-id` already reaches the pod** — Envoy adds it from the JWT and the Lua never removes it; no pod code reads it today (no hits in `sdk/org/libs/{cli,core}` or `apps/web`) | A pre-existing, trustworthy seam for delivering the caller's identity to the pod. |

---

## Part 2 — The topology decision

Everything downstream depends on one choice. There are three coherent answers.

### Option A — Live shared pod (guest's browser reaches the owner's pod)

The project stays in one place; guests are routed to the owner's pod and act on the real thing.

- ✅ The only option that actually satisfies the request: guests **use the spaces and the app** and
  see live, current state. Write access is genuinely collaborative.
- ✅ One copy of the data; no sync, no conflicts, no divergence.
- ❌ Requires a real authorization plane at the edge **and** a real auth layer in the pod (§1.2).
- ❌ The owner pays for all guest LLM spend and hosts all guest load on their tier's pod.
- ❌ A guest's presence keeps the owner's pod awake, competing for `MAX_SESSIONS` and memory.

### Option B — Copy / fork (project is replicated into the guest's own pod)

Share = install a snapshot of the project into the guest's pod, optionally re-syncing.

- ✅ Almost no new security surface: it reuses the existing install path, and each user still only
  ever talks to their own pod. Each user pays for their own compute and tokens.
- ❌ **It is not sharing.** Two users looking at "the same project" see different data; a shared app
  with a database is meaningless (each copy has its own `.data/app.db`). "Read-only" degenerates to
  "you got a copy you can do whatever you like with", which is the opposite of the requirement.
- Useful as a *distribution* feature ("publish a project template"), which the store already is.

### Option C — Hybrid: live for read, live for write, copy for neither

Not a real third option — it collapses into A. Worth naming only to dismiss it.

**Recommendation: Option A.** The requirement — "use the spaces and the app without the ability to
change" — is only meaningful against live shared state. Accept that this means building pod-side
auth; there is no shortcut around it.

---

## Part 3 — What must be built (Option A)

Nine work areas. They are ordered by dependency: 3.1 and 3.2 are prerequisites for everything else,
and **3.3 is the security core — nothing may ship before it.**

### 3.1 A sharing model in the gateway

New Postgres tables (following the `ensureSchema()` + `cloud/migrations/NNN_*.sql` pattern —
`cloud/gateway/src/lib/db.ts#ensureSchema`):

```sql
CREATE TABLE project_shares (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     text NOT NULL,          -- profiles.id
  project_id   text NOT NULL,          -- the directory name on the owner's pod
  grantee_id   text,                   -- NULL until an invite is accepted
  grantee_email text,                  -- how the invite was addressed
  role         text NOT NULL,          -- 'viewer' | 'editor' (see §3.4 for what these mean)
  status       text NOT NULL,          -- 'pending' | 'active' | 'revoked'
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  UNIQUE (owner_id, project_id, grantee_id)
);
CREATE INDEX ON project_shares (grantee_id) WHERE status = 'active';
```

New gateway routes (all `authMiddleware`):

| Route | Purpose |
|---|---|
| `GET /api/shares/mine` | Projects **I own** that are shared, with their grantees |
| `GET /api/shares/with-me` | Projects **shared with me** → `[{ ownerId, projectId, role, ownerEmail }]` — this is what makes shared projects appear in the guest's UI |
| `POST /api/shares` | `{ projectId, granteeEmail, role }` → create a pending invite |
| `POST /api/shares/:id/accept` | Grantee accepts; binds `grantee_id` |
| `PATCH /api/shares/:id` | Change role |
| `DELETE /api/shares/:id` | Revoke |
| `POST /api/shares/:id/token` | **Mint a grant token** (§3.2) |

Two things the gateway does not have and will need: resolving an email to a user id (Zitadel already
exposes `getUserByEmail`, `cloud/gateway/src/lib/zitadel.ts`), and verifying that `projectId` really
exists on the owner's pod at share time — which means the gateway calling into the pod, or accepting
that a share may name a project that was since deleted.

### 3.2 Routing: reaching a pod that is not yours

Envoy currently computes the upstream from `sub` alone. Three ways to change that, in increasing
order of invasiveness:

**(a) Grant-token claim read by the Lua — recommended.**
`POST /api/shares/:id/token` mints a short-TTL JWT (say 15 min, refreshable) with
`{ sub: granteeId, aud: 'share', pod: ownerId, prj: projectId, role: 'viewer'|'editor' }`. The
SecurityPolicy adds `claimToHeaders` entries for `pod`, `prj` and `role`; the Lua prefers the `pod`
claim over `x-user-id` when building the upstream:

```lua
local target = request_handle:headers():get("x-pod-id") or request_handle:headers():get("x-user-id")
```

Authorization is thereby *baked into the token at mint time* by the gateway, which owns the share
table. Envoy stays a dumb router and needs no per-request policy lookup. Revocation is bounded by
the token TTL — acceptable if the TTL is short and the pod also re-validates (§3.3).

**(b) `ext_authz` to the gateway.** Envoy Gateway supports it, but it puts a synchronous gateway
call on every pod request. Gives instant revocation; costs latency and a new failure mode. Consider
only if immediate revocation is a hard requirement.

**(c) Gateway-proxied path** (`/api/shared/:shareId/*` forwarded gateway→pod, as
`cloud/gateway/src/lib/pod-proxy.ts` already does for LOCAL_DEV). Zero Envoy change and trivially
correct, but makes the gateway a data-plane hop for all guest traffic including WebSockets. Fine for
a first prototype, wrong for production.

Whichever is chosen, **three more transports need the same treatment**:
- `WS /api/ws?access_token=` — the agent trace socket, routed by the same `access_token` query param
  extractor (`devops/argocd/envoy/chat-policies.yaml:129-130`).
- The `access_token` **cookie** used by the `lmthing.app` root mount so page navigations and relative
  `<script>/<link>` assets route to the right pod (`sdk/org/apps/web/src/lib/pod-session.ts`,
  `devops/argocd/envoy/app-policies.yaml:182-186`). A guest opening a shared app needs a *grant*
  cookie, and the browser can hold only one `access_token` cookie per origin — so either the cookie
  name becomes share-scoped or the app mount moves to a share-scoped path.
- Pod wake. The Lua activator calls `POST /api/compute/wake` with the caller's token, and
  `authMiddleware` "verif[ies] the forwarded JWT — a caller can only wake its own pod"
  (`devops/argocd/envoy/app-policies.yaml:121-123`). A guest must be able to wake the *owner's*
  scaled-to-zero pod, so `/api/compute/wake` and `/wake-wait` need to accept a grant token and wake
  `pod` rather than `sub`.

### 3.3 Pod-side authentication and authorization — the security core

The pod must stop trusting its socket. Minimum viable shape:

1. **Establish a principal per request.** In `startSessionServer`'s request handler
   (`sdk/org/libs/cli/src/server/serve.ts:L343-L370`), before `router.dispatch`, derive
   `{ actorId, role, scopeProjectId }` from the Envoy-injected headers. Default when the headers say
   the caller is the pod owner: full authority, exactly as today — so the owner's experience and all
   local/CLI usage are unchanged (a missing principal in a non-gateway context must mean *owner*, or
   `pnpm thing` and every test breaks).
2. **Deny-by-default for guests on pod-global surfaces.** A request carrying a guest principal is
   rejected outright on: `/api/env`, `/api/fs/*`, `WS /api/terminals/*`, `/api/restart`,
   `/api/backup*`, `/api/restore`, `/api/session-ledger`, `/api/hooks`, `POST /api/projects`,
   `DELETE /api/projects/:id`. This is a hard allowlist, not a blocklist — new routes must be
   *opted in* to guest reachability, or the next feature silently opens a hole.
3. **Project scoping.** Every `/api/projects/:projectId/*` route asserts
   `projectId === principal.scopeProjectId` for a guest. `GET /api/projects` returns only the shared
   project (plus, arguably, `system` for space resolution). `POST /api/sessions { projectId }` — the
   only way a project is "selected" (`sdk/org/libs/cli/src/server/routes/sessions.ts:20-35`) — must
   be scoped identically, or a guest simply names a different project and reads it.
4. **Role gate.** `viewer` ⇒ every non-idempotent route on the scoped project is 403: the space-file
   `PUT`/`POST`/`DELETE`, `PUT .../instructions`, `POST .../documents`, `PUT .../app/files/*`,
   `PATCH .../app/data/:table/:id`, `POST .../hooks/:slug/run`, `POST .../app/build`,
   `POST /api/apps/install`, `POST /api/store/spaces/install`, `POST /api/spaces`.
5. **Independent re-validation.** The pod should periodically confirm the share is still active
   rather than trusting the grant token alone for its full TTL — a small cached call to a new
   gateway endpoint, using the pod's existing `aud:"compute"` JWT
   (`cloud/gateway/src/lib/tokens.ts:99-121`). This is what makes revocation take effect in seconds
   instead of at token expiry.

### 3.4 Read-only is not an HTTP concern — it is a capability concern

This is the subtlest part of the whole feature and the easiest to get wrong.

"Use the spaces without the ability to change" cannot be implemented by blocking mutating HTTP
routes, because **running an agent is itself a write**. A single `viewer` chat turn can, entirely
through legitimate GET/POST-a-message flows:

- write rows via `db.insert`/`db.update` (`db:write` — `sdk/org/libs/core/src/exec/app-globals.ts:149`);
- create tables (`db:schema`), write pages/api/hooks (`pages:write`, `api:write`, `hooks:write`);
- install a space (`store:install`, consent-gated but the *guest* would be giving the consent);
- write knowledge into the space (`knowledge:write`);
- fire events and trigger hooks that write (`events:emit`);
- persist a session transcript into the owner's project (§1.3);
- and spend the owner's LLM budget (§1.2, §3.6).

So `viewer` must additionally **intersect the agent's `CapabilityProfile` at session creation** —
strip every write grant (`db:write`, `db:schema`, `pages:write`, `api:write`, `hooks:write`,
`knowledge:write`, `store:install`, `project:manage`, `fs:scratch`) and leave the read set
(`db:read`, `store:read`, `api:call` restricted to safe endpoints). Because the capability profile
drives both global injection *and* the typecheck DTS
(`sdk/org/libs/core/src/exec/bootstrap.ts:L99`; `org/docs/runtime/typecheck.md`), a stripped grant
fails typecheck and the model retries with a different approach instead of throwing — which is
exactly the behaviour you want. This is the mechanism the codebase already prescribes: *never forbid
a capability in prose, remove the grant*.

Two consequences to accept explicitly:
- A read-only guest gets a **degraded agent**. An assistant whose whole job is to record something
  will now correctly refuse. That is the honest semantics of "viewer", but it must be surfaced in
  the UI rather than presenting as a mysterious failure.
- `apiCall` needs a policy. A project API endpoint is arbitrary Node code that can write to the db
  regardless of the caller's capabilities (`sdk/org/libs/cli/src/app/api/runtime.ts`). Either
  viewers get no `api:call`, or endpoints must be declared read-only and the runtime must enforce it.

### 3.5 The shared app — the hardest half

"Use the app" is a separate problem from "use the spaces", and it is where the current design gives
you the least to build on: the app API runtime receives *no identity at all*
(`sdk/org/libs/cli/src/server/routes/app-api.ts:53`). Three things are needed:

1. **An actor in `ctx`.** Thread the principal from the HTTP layer through
   `createAppApiHandler` → `runtime.handle` → the worker into the handler's `ctx`, so app code can
   see who is calling. This changes the app-authoring contract and therefore
   `org/docs/format/project/api/README.md` and the generated `@app/types`.
2. **A write policy for viewers.** Without per-endpoint declarations, the only safe default is that
   a `viewer` may issue `GET` requests to the app API and nothing else — crude, and it breaks any
   app whose reads are modelled as POSTs. Declaring `export const readOnly = true` (or deriving it
   from the HTTP method file name, which already encodes intent —
   `sdk/org/libs/cli/src/app/api/loader.ts#METHOD_FILE_RE`) is the cleaner path.
3. **A data model decision.** A shared app has one `.data/app.db`. Do all guests see all rows? For a
   family recipe book, yes. For anything with per-person state, the app needs an owner column and
   row-level filtering — which is application logic no platform primitive currently provides. This
   should be scoped out of v1 and stated as a known limitation, not silently shipped.

Page serving is comparatively easy: `/app/<project>/*` and the root mount are static bundle serving
(`sdk/org/libs/cli/src/app/pages-serve.ts`, mounted `serve.ts:L306,:L325`) and need only the routing
and cookie work from §3.2.

### 3.6 Billing, capacity and abuse

Unavoidable questions, each needing an explicit answer before launch:

- **Who pays for guest LLM spend?** Today, structurally, the owner (§1.2). *Owner-pays* is simple
  and matches "I shared my project"; it also means one guest can drain the owner's rolling budget.
  *Guest-pays* requires per-request LiteLLM key selection inside the pod — the key currently arrives
  once, as a pod env var — plus a way for the pod to obtain a guest's key. That is a substantial new
  mechanism; recommend **owner-pays in v1**, with a per-share spend cap and a visible meter.
- **Capacity.** The pod is sized by the *owner's* tier (`cloud/gateway/src/lib/tiers.ts`), memory
  pressure already 503s new sessions (`sdk/org/libs/cli/src/server/routes/sessions.ts:15-19`), and
  `MAX_SESSIONS` defaults to 24 pod-wide
  (`sdk/org/libs/cli/src/server/session-manager.ts:296`). Guests consume the same pool. Sharing
  probably needs to be a paid-tier capability, with the guest count bounded per tier.
- **Idle/wake.** Guest traffic keeps the owner's pod awake via the self-idle watchdog
  (`serve.ts:L328-L357`), and a guest's first click on a cold project pays the wake cost. Both are
  fine, but the wake path must accept a grant token (§3.2).
- **Denial of service.** A guest can trigger hook runs, agent turns and page builds. Per-share rate
  limiting at the gateway (the inbound broker's token bucket is a usable model —
  `cloud/gateway/src/routes/inbound.ts:74-105`) is the natural place.

### 3.7 Session privacy

Because sessions persist inside the project directory (§1.3), guest conversations are visible to the
owner and to every other guest via `GET /api/projects/:id/sessions`. Options: partition by actor
(`sessions/<actorId>/...`, and filter the listing by principal), keep them shared and say so, or
make it a per-share setting. **The default must be a decision, not an accident** — a guest will
reasonably assume their chat is private.

### 3.8 SPA changes

- **Project list becomes a union.** `/studio` and `/chat` currently list projects from the single
  pod (`GET /api/projects`). They must merge the owner's own projects with
  `GET /api/shares/with-me`, and label each entry with owner + role.
- **The pod target becomes per-project.** `COMPUTER_BASE_URL` is a single module-level constant
  resolved from the current host (`sdk/org/apps/web/src/lib/config.ts:18`). Every pod call and the
  WS connection must instead carry the grant token for the selected project. This is a pervasive
  but mechanical refactor: thread a "pod session" (base URL + token) through instead of a constant.
- **Grant-token lifecycle** alongside the existing session refresh in `@lmthing/auth`
  (`sdk/org/libs/auth/src/client.ts#ensureValidToken`) — mint on project select, refresh before
  expiry, drop on revocation (403 → return to the project list with an explanation).
- **Read-only affordances.** Disabled editors, hidden install/delete actions, an explicit
  "you're viewing <owner>'s project" banner, and a clear message when a viewer's agent declines a
  write. `PodEnsureGate` (`sdk/org/apps/web/src/lib/gates.tsx:216`) also needs a guest variant — it
  currently ensures *your* pod.
- **Sharing UI**: an invite/manage panel on the project, and an accept flow.

### 3.9 Documentation

Per the repo contract, this ships with `org/docs/` updates in the same change:
`cloud/routes.md` + `cloud/auth.md` (new routes, new `aud:"share"` token), `devops/infrastructure.md`
(the routing change), `cli-api/rest/README.md` + `projects.md` (the pod finally *has* auth — the
"Auth: none at this layer" section is directly contradicted), `format/project/api/README.md`
(`ctx.actor`), `runtime-globals/` (role-based capability intersection), `studio/` and `app/`.

---

## Part 4 — Suggested staging

Each stage is independently shippable and leaves the system in a coherent state.

| Stage | Scope | Ships |
|---|---|---|
| **0** | §3.1 gateway share model + routes + invite/accept UI. No data-plane change. | Shares exist and are visible; opening one is not yet possible. Fully safe. |
| **1** | §3.3 pod principal + deny-by-default allowlist + project scoping + role gate. Still no external guest traffic. | The pod is safe to expose. Testable in isolation with synthetic headers. |
| **2** | §3.2 grant tokens + Envoy `pod`-claim routing + guest-capable wake. | A guest can open a shared project **read-only, spaces only**. First end-to-end milestone. |
| **3** | §3.4 capability intersection for `viewer`; `editor` role enabled. | Read-only is real (not just HTTP-shaped); write access works. |
| **4** | §3.5 shared app serving + `ctx.actor` + endpoint read-only declarations. | Guests can use the app. |
| **5** | §3.6 per-share budget caps, rate limits, tier gating; §3.7 session partitioning. | Production-ready. |

A useful smaller first step, if the appetite is for a demo rather than a product: implement stages 0
and 1, then use **option (c)** from §3.2 (gateway-proxied path) to get an end-to-end read-only share
working without touching Envoy at all. It is the wrong production architecture but it validates the
model in days rather than weeks, and stages 0/1/3 carry over unchanged.

---

## Part 5 — Decisions needed before implementation

These change the design materially; I have flagged my recommendation but they are yours to make.

1. **Who pays for a guest's LLM usage?** → recommend owner-pays with a per-share cap (§3.6).
2. **May a `viewer` run agents at all**, given every agent turn spends the owner's money and a
   degraded read-only agent is a worse experience than no agent? → recommend yes, with stripped
   write capabilities and a visible spend cap.
3. **Are guest chat sessions private from the owner?** → recommend yes, partitioned by actor (§3.7).
4. **Do guests get the full Studio IDE, or a restricted surface?** Studio exposes raw space files and
   the app admin; a viewer arguably wants Chat + the app, not the IDE.
5. **Is sharing a paid-tier capability, and how many guests per tier?** (§3.6)
6. **Do we need instant revocation?** If yes, §3.2(b) `ext_authz`; if "within a minute" is fine, the
   short-TTL grant token plus pod re-validation is simpler and cheaper.
7. **Is `editor` allowed to install spaces/apps into the owner's pod?** It writes to the owner's disk
   and can pull in code the owner never reviewed.

---

## Part 6 — Summary

Sharing a project is not a feature that can be added at the project layer — it is a change to the
system's tenancy model. Today, **identity, routing destination, trust boundary, and billing account
are all the same value**: the user id in the JWT `sub`. Sharing means separating "who is asking"
from "whose runtime is answering", and everything that assumed those were identical has to be
revisited.

Concretely, the work is:

1. A share/role model in the gateway (new tables + routes + invite flow) — moderate, self-contained.
2. A grant token and a routing plane that honours it — small in code, high in blast radius.
3. **Authentication and authorization inside the pod, which currently has none** — the largest and
   most safety-critical item; the pod today grants a shell, the filesystem and every secret to
   anyone who reaches it.
4. Role-aware capability intersection in the runtime, because read-only cannot be enforced at the
   HTTP layer alone — running an agent *is* writing.
5. Identity plumbed into the project-app runtime, which has none at all.
6. Explicit answers on billing, capacity, and session privacy — all of which today have an implicit
   answer ("the owner") that stops being acceptable the moment a second person is involved.

The single highest-value next step is **§3.3 (pod auth)**: it is a prerequisite for every variant of
this feature, it is independently testable, and it closes a real hole in the current architecture
regardless of whether sharing ever ships.
