# Teams — shared projects, spaces and a team chat surface

**Status: design proposal. None of "What must be built" exists today.**

This document answers: *what is needed so several lmthing users can work on the same projects and
spaces, some read-only and some with write access, inside a team that also gives them a Slack-like
place to talk and to call THING?*

Part 2 is grounded in the current code (every claim cited). Parts 3–7 are design.

> Convention: `org/docs/` is the source of truth for what **is**. This file is deliberately outside
> it because it describes what **isn't** yet. When any of this ships, the facts move into
> `org/docs/` per [`org/docs/SYNC.md`](../org/docs/SYNC.md) and the corresponding section here is
> deleted.

---

## Part 1 — The model

A **team** is a first-class principal, parallel to a user:

- It owns a **pod** of its own (namespace `team-<id>`, its own PVC) — not a share of anyone's.
- It has a **tier** and its own **env**: its own LiteLLM key, its own budget windows, its own
  integration credentials. A team's spend is the team's, never a member's.
- It owns **multiple projects and spaces**, living at the normal `<root>/<projectId>/` layout on the
  team pod's volume.
- It serves a **Slack-like chat application** — itself an lmthing project-app — where members talk to
  each other and invoke THING.
- Members join with a **role**: `viewer` (use the spaces and the app, change nothing) or `editor`.

Three planes, all on the team pod:

| Plane | What it is | Where it runs |
|---|---|---|
| **Conversation** | the chat app — channels, messages, membership UI | a project-app on the team pod (`database/ api/ pages/ hooks/`) |
| **Content** | the team's projects and spaces | the team pod's PVC, standard layout |
| **Execution** | agent turns, hooks, cron, the THING bridge | the team pod runtime, on the team's LiteLLM key |

**Decisions already taken** (they close the biggest open questions from earlier drafts):

1. **Team pod**, not a shared volume mounted into member pods.
2. **Team tier + team env** — the team is its own billing and credential principal.

---

## Part 2 — Where we are today

### 2.1 No sharing model exists anywhere

- The gateway's own Postgres tables are `profiles`, `sso_codes`, `backup_config`, `user_cron_jobs`,
  `webhook_bindings`, `controller_ticks` (`cloud/gateway/src/lib/db.ts#ensureSchema`). No team,
  membership, role or ACL table.
- No gateway route grants or checks access to another principal's resources; the mounts are auth /
  keys / billing / stripe-webhook / compute / backup / inbound / status / issues
  (`cloud/gateway/src/index.ts:28-38`).
- `lmthing.team` is a route scaffold: "There is no room backend, no shared VFS and no membership
  model" (`team/README.md`).
- `ProjectMeta` is `{ id, name, createdAt }` (`sdk/org/libs/cli/src/server/projects.ts#ProjectMeta`)
  — a project records no owner and no visibility.

### 2.2 Identity is currently the tenancy boundary

Four layers all assume "the caller is the pod's owner". A team pod breaks that assumption on
purpose, so each has to change.

**Routing derives the destination pod from the JWT subject.** Envoy validates the gateway-issued
HS256 JWT and maps `sub` to `x-user-id` (`devops/argocd/envoy/chat-policies.yaml:118-139`); a Lua
filter builds the upstream from it:

```lua
local user_id = request_handle:headers():get("x-user-id")
local upstream = "lmthing.user-" .. user_id .. ".svc.cluster.local:8080"
```
(`devops/argocd/envoy/chat-policies.yaml:26-44`)

There is no authorization step — no `ext_authz`, no policy lookup. **Who you are** and **which pod
answers** are the same value.

**The pod has no authentication of its own.** "There is no token check and no auth middleware"
(`org/docs/cli-api/rest/README.md`, grounded at `sdk/org/libs/cli/src/server/serve.ts:L343-L370`).
Reaching the port is full authority:

| Surface | Grants | Citation |
|---|---|---|
| `WS /api/terminals/:termId` | an interactive **shell** at the runtime root | `ws/terminal.ts#handleTerminalWsUpgrade` |
| `GET/PUT /api/fs/*` | read/write any file under the root | `routes/fs.ts` |
| `GET/PUT /api/env` | read and replace `.env` — **every secret** | `routes/env.ts#handleEnvPut` |
| `GET /api/projects` | every project, unfiltered | `projects.ts#listProjects` |
| `DELETE /api/projects/:id` | delete any project but `user`/`system` | `routes/projects.ts#handleDeleteProject` |
| `PUT .../spaces/:id/files` | wipe-and-rewrite a space dir | `routes/projects.ts#handlePutProjectSpaceFiles` |
| `POST /api/restart` | kill the process | `serve.ts:143-147` |

This is safe today only because the pod's network position guarantees one caller. **A team pod is
multi-user by definition, so pod auth is a prerequisite, not a follow-up.**

**One pod, one LiteLLM key.** The gateway fetches the principal's virtual key and injects it into
the pod's `user-env` secret at create time (`cloud/gateway/src/lib/compute.ts:583-600`, via
`getLiteLLMKey` `:312` and `litellmEnvDefaults` `:343`). There is no per-request key selection. A
team tier is what makes this correct rather than a leak.

**The project-app runtime has no request identity.** Dispatch is
`handle(method, path, input)` — no principal (`sdk/org/libs/cli/src/app/api/runtime.ts:103`,
called at `sdk/org/libs/cli/src/server/routes/app-api.ts:53`).

### 2.3 What the pod already gives a team for free

- **Project + space discovery** — `listProjects` is "every subdirectory of `<root>` with a readable
  `project.json`" (`projects.ts#listProjects`). A team pod's projects need no new discovery model.
- **The whole app platform** — `database/*.json` → SQLite at `<project>/.data/app.db`
  (`app/store.ts`), file-routed worker-isolated Node handlers in `api/`, esbuild-bundled React
  `pages/`, and `hooks/` (`org/docs/format/project/README.md`). The chat app is an ordinary app.
- **Capabilities** — 14 grant ids gating every write global, driving both injection *and* the
  typecheck DTS, so an ungranted call fails typecheck rather than throwing
  (`sdk/org/libs/core/src/spaces/capabilities.ts#CAPABILITY_IDS`,
  `sdk/org/libs/core/src/exec/bootstrap.ts:L99`).
- **Audience-scoped JWTs** — `signComputeToken`/`signBackupToken`/`signInboundToken`, `aud`-pinned,
  subject authoritative (`cloud/gateway/src/lib/tokens.ts:56-194`). The shape a membership token
  needs.
- **Tiers are one object literal** — everything else resolves by name or price id, so adding tiers
  needs "no route code changes" (`org/docs/contributing/add-a-tier.md`;
  `cloud/gateway/src/lib/tiers.ts#Tier`).

### 2.4 The THING bridge already exists, as the integration-space pattern

A team channel calling THING is structurally identical to the shipped Slack integration:

- **Inbound** — `events/messages.ts` is a `WebhookEmitterDef` that normalizes the platform envelope
  into `message.received` carrying `{ text, from, chatId, threadKey }`
  (`store/spaces/integration-slack/events/messages.ts`).
- **Thread continuity** — `getOrCreateThreadSession` maps `<path>::<threadKey>` to a stable session
  id so repeated messages continue **one persisted multi-turn session**
  (`sdk/org/libs/cli/src/server/webhook-threads.ts`), driving `runHeadlessThreaded`
  (`sdk/org/libs/cli/src/server/session-manager.ts:1993`).
- **Outbound** — the agent replies through an ordinary space function over `callConnection`
  (`store/spaces/integration-slack/functions/slackPostMessage.ts`).

Thirteen integration spaces ship on this pattern. **The team bridge should be a first-party event
source, not a new invocation path** — then THING behaves identically whether the room is
lmthing.team or Slack.

### 2.5 Two gaps that block the chat app specifically

- **Project-apps cannot do realtime.** The upgrade handler matches only `/api/terminals/:id` and
  hands everything else to the agent WS, which destroys unknown pathnames
  (`sdk/org/libs/cli/src/server/serve.ts:405-416`). The API contract is a buffered
  `ApiResponse { status, body }` (`app/api/runtime.ts:61-63`) — no streaming, no SSE. **A chat app
  on today's app platform can only poll.**
- **App handlers inherit the pod environment.** Workers launch as
  `new NodeWorker(source, { eval: true, workerData: job })` with no `env` option
  (`app/api/runtime.ts:296`), so handler code sees `process.env` — on a team pod, the team's
  credentials. Fine for team-authored code; it means an `editor` is trusted with team secrets.

### 2.6 Rejected: one shared volume mounted into member pods

Recorded because it was explored and is a dead end on this cluster. The chain:

A PVC is namespaced and a pod may only reference a claim in its own namespace, so a "team volume"
means one PVC per member namespace bound to one PV → that requires **ReadWriteMany**. But
`user-data` is `accessModes: ["ReadWriteOnce"]` with no `storageClassName`
(`cloud/gateway/src/lib/compute.ts:164-179`), binding the cluster default — which in production is
`local-path` (`rancher.io/local-path`), applied out-of-band and provisioned by nothing in this repo
(`org/docs/devops/infrastructure.md`, Storage). local-path is a node-local hostPath provisioner: it
cannot do RWX, and its PV lives on exactly one node. Moving to an RWX class backed by NFS or Azure
Files then breaks the database, because the project db runs `PRAGMA journal_mode = WAL`
(`sdk/org/libs/cli/src/app/store.ts:298-300`) and WAL does not work over network filesystems.

Three further problems it carried: a read-only mount cannot serve an app at all (the page build
writes `<projectRoot>/.data/pages-dist/`, `.data/pages-build/`, `.data/pages-cache.json` —
`app/build/pages.ts:73-75,138` — alongside the db and `emitter-state.json`); mounting is a pod-template
patch and therefore a rolling restart, which `compute.ts` deliberately avoids elsewhere
(`compute.ts:246-249`); and each member's pod would publish the same cron manifest, so automation
fires once per member (`cloud/gateway/src/routes/compute.ts:89-134`, stored per user).

**A team pod deletes every one of these.** One pod, one writer, one namespace, one PVC, normal
storage class, WAL intact, no mount churn, one executor.

---

## Part 3 — What the team pod costs

The team pod trades a problem that is *physically blocked* for one that is *merely work*: it
relocates multi-user access rather than removing it. The shared-volume model had one elegant
property — read-only enforced by the kernel at the mount — and the team pod gives that up, because
there is one mount and the chat app must write. So read-only must be enforced in software, and the
pod must authenticate.

---

## Part 4 — What must be built

Ordered by dependency. **4.5 is the security core; nothing may ship before it.**

### 4.1 The team model in the gateway

New tables, following the `ensureSchema()` + `cloud/migrations/NNN_*.sql` pattern
(`cloud/gateway/src/lib/db.ts#ensureSchema`):

```sql
CREATE TABLE teams (
  id           text PRIMARY KEY,          -- also the pod namespace suffix: team-<id>
  name         text NOT NULL,
  tier         text NOT NULL DEFAULT 'team_free',
  stripe_customer_id text UNIQUE,
  created_by   text NOT NULL,             -- profiles.id
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id      text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id      text,                      -- NULL until an invite is accepted
  invited_email text,
  role         text NOT NULL,             -- 'owner' | 'editor' | 'viewer'
  status       text NOT NULL,             -- 'pending' | 'active' | 'removed'
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX ON team_members (user_id) WHERE status = 'active';
```

New routes (all `authMiddleware`): `POST /api/teams`, `GET /api/teams/mine`,
`GET /api/teams/:id`, `POST /api/teams/:id/members`, `POST /api/teams/:id/members/accept`,
`PATCH /api/teams/:id/members/:userId` (role change), `DELETE /api/teams/:id/members/:userId`,
and `POST /api/teams/:id/token` (§4.4). Email → user id resolution already exists
(`zitadel.getUserByEmail`, `cloud/gateway/src/lib/zitadel.ts`).

### 4.2 Team tiers and team env

A team tier is one more entry in `TIERS` — the file's own header says it is "one of ~10 places that
need updating across the monorepo", and the checklist is
[`org/docs/contributing/add-a-tier.md`](../org/docs/contributing/add-a-tier.md). Every `Tier` field
is required and `npx tsc` in `cloud/gateway/Dockerfile` gates the image build
(`cloud/gateway/src/lib/tiers.ts#Tier`).

Team tiers differ from user tiers on the axes that actually matter for a shared pod — `pod.cpu`,
`pod.mem`, `pod.maxSessions`, `pod.idleTtlMinutes` (§4.11), `budgetLimits`, and `cron` — plus a new
`maxMembers`. Note the current per-user defaults are small: `DEFAULT_POD_CONFIG` is 500m/1Gi with
`maxSessions: 3`, while the in-pod ceiling is `MAX_SESSIONS`, default 24
(`sdk/org/libs/cli/src/server/session-manager.ts:296`). A team pod hosting a chat app plus N
concurrent member sessions needs its own sizing curve, not a copy of `pro`.

**Team env** falls out of the existing machinery once the team is a LiteLLM principal: provision a
LiteLLM user and a Stripe customer keyed `team-<id>` exactly as `provisionUser` does per user
(`cloud/gateway/src/routes/auth.ts#provisionUser`), and `getLiteLLMKey("team-<id>")` then feeds the
same `litellmEnvDefaults` injection (`compute.ts:583-600`). Integration credentials likewise become
team-scoped: `missingRequired` is computed against `process.env`
(`sdk/org/libs/cli/src/server/routes/store-spaces.ts:479-491`), so a team's Slack connection is
configured once, on the team pod, by an owner.

Consequence to state plainly: **an `editor` is trusted with team credentials**, because handler and
hook code they author runs with the team pod's `process.env` (§2.5). Editors are a trust boundary,
not just a permission level.

### 4.3 Team pod provisioning

`createUserPod` is user-shaped end to end — `user-${userId}` namespace, `user-data` PVC, the
`lmthing` Deployment, `signComputeToken(userId)`, tier resolved from the user's LiteLLM metadata
(`cloud/gateway/src/lib/compute.ts:543-660`). The refactor is broad but mechanical: parameterize
**principal** (`user-<id>` | `team-<id>`) instead of user, and thread it through `ensureUserPod`,
`scaleUserPod`, `wakeUserPod`, `getPodInternalBaseUrl`, `sweepIdlePods`, `deleteUserPod` and
`getUserPodStatus`. The cron and webhook manifest tables are keyed by user id today
(`cloud/gateway/src/routes/compute.ts:89-134`) and need the same widening.

### 4.4 Routing to a team pod

Envoy currently computes the upstream from `sub` alone, which cannot express membership. Recommended:
a **membership token** minted by `POST /api/teams/:id/token` — short TTL (~15 min, refreshable),
`{ sub: userId, aud: 'team', team: teamId, role }`. The `SecurityPolicy` adds `claimToHeaders` for
`team` and `role`; the Lua prefers the team claim when present:

```lua
local team = request_handle:headers():get("x-team-id")
local target = team and ("team-" .. team) or ("user-" .. request_handle:headers():get("x-user-id"))
```

Authorization is baked in at mint time by the gateway, which owns the membership table; Envoy stays
a dumb router. Revocation is bounded by the TTL, with pod-side re-validation closing the gap (§4.5).

Three transports need the same treatment: the agent WS (`?access_token=` extractor), the
`access_token` **cookie** used by the app root mount so page navigations and relative assets route
correctly (`sdk/org/apps/web/src/lib/pod-session.ts`) — a browser holds one cookie per name per
origin, so team and personal sessions collide unless the cookie or the mount path is team-scoped —
and **pod wake**, where the activator forwards the caller's JWT and `authMiddleware` currently
guarantees "a caller can only wake its own pod" (`devops/argocd/envoy/app-policies.yaml:121-123`).

Alternative if instant revocation is a hard requirement: `ext_authz` to the gateway, at the cost of
a synchronous hop on every pod request.

### 4.5 Pod authentication and authorization — the security core

The pod must stop trusting its socket:

1. **Establish a principal per request**, in the request handler before `router.dispatch`
   (`serve.ts:L343-L370`), from the Envoy-injected headers → `{ actorId, role }`. A missing
   principal in a non-gateway context must mean *owner* — otherwise `pnpm thing`, the CLI and every
   test break.
2. **Deny-by-default allowlist for non-owner principals** on pod-global surfaces: `/api/env`,
   `/api/fs/*`, `WS /api/terminals/*`, `/api/restart`, `/api/backup*`, `/api/restore`,
   `/api/session-ledger`, `POST`/`DELETE /api/projects`. New routes must be *opted in*, or the next
   feature silently opens a hole.
3. **Role gate.** `viewer` ⇒ 403 on every mutating route: the space-file `PUT`/`POST`/`DELETE`,
   `PUT .../instructions`, `POST .../documents`, `PUT .../app/files/*`,
   `PATCH .../app/data/:table/:id`, `POST .../hooks/:slug/run`, `POST .../app/build`,
   `POST /api/apps/install`, `POST /api/store/spaces/install`, `POST /api/spaces`.
4. **Re-validate membership** on a short cache rather than trusting the token for its full TTL,
   using the pod's existing `aud:"compute"` JWT. This is what makes removal take effect in seconds.

### 4.6 Read-only is a capability concern, not an HTTP one

Blocking mutating routes is not enough, because **running an agent is itself a write**. One
`viewer` chat turn can otherwise insert rows (`db:write`), create tables (`db:schema`), write
pages/api/hooks, install a space, write knowledge, emit events that trigger writing hooks, and
persist a transcript.

So `viewer` must additionally **intersect the agent's `CapabilityProfile` at session creation** —
strip `db:write`, `db:schema`, `pages:write`, `api:write`, `hooks:write`, `knowledge:write`,
`store:install`, `project:manage`, `fs:scratch`; keep `db:read`, `store:read`, and `api:call`
narrowed to read-only endpoints. Because the profile drives injection *and* the DTS
(`libs/core/src/exec/bootstrap.ts:L99`), a stripped grant fails typecheck and the model retries
differently instead of throwing — the behaviour the codebase already prescribes.

Two consequences to surface in the UI rather than let users discover: a viewer gets a **degraded
agent** that will correctly refuse to record things, and `apiCall` needs a policy because an
endpoint is arbitrary Node code that can write regardless of the caller's grants.

**When THING acts in a channel, the capability intersection must key off the invoking member's
role**, not the agent's grants — a viewer invoking a writing agent has to fail cleanly.

### 4.7 Caller identity in the app runtime — day-one blocker

`handle(method, path, input)` takes no principal (`app/api/runtime.ts:103`). You cannot build a chat
app where every message is from "the pod". Thread the principal from the HTTP layer through
`createAppApiHandler` → `runtime.handle` → the worker into `ctx.actor`. This changes the
app-authoring contract, so `org/docs/format/project/api/README.md` and the generated `@app/types`
move with it — and it is what finally makes shared apps meaningful generally, not just for chat.

### 4.8 A realtime seam for project-apps — day-one blocker

Today a chat app can only poll (§2.5). Options, cheapest first: an SSE response kind in
`ApiResponse`; or a declared WS path per app, matched in the upgrade handler alongside
`/api/terminals/:id` (`serve.ts:405-416`). Either is useful to every app, not only this one. Worth
noting the pod is a **single Node process**, so in-memory fan-out is trivial — no broker needed,
unlike a gateway-hosted design where `replicas: 2` (`devops/argocd/core/gateway.yaml:57`) would have
forced Postgres `LISTEN/NOTIFY`.

### 4.9 The chat application

An ordinary project-app on the team pod: `database/` for channels, messages, memberships and read
state; `api/` for post/list/subscribe; `pages/` for the client; `hooks/` for notifications. It is
the first app that genuinely needs §4.7 and §4.8, and it is the platform dogfooding itself — every
limitation it hits is one every team app would hit.

### 4.10 The THING bridge

A first-party integration space on the team pod, shaped like `integration-slack` (§2.4): an
`events/` emitter def turning a channel message into `message.received`, `getOrCreateThreadSession`
giving each channel thread a persistent multi-turn session, and a space function posting the reply
back through the chat app's own API. Because it is an ordinary event source, `@thing` in a team
channel and `@thing` in Slack take the same path.

Open sub-question: **how much channel history the agent sees.** A thread session gives it the
thread; a room has history it may need and may not be entitled to — a privacy question and a
context-window question at once.

### 4.11 Always-on vs scale-to-zero

A chat pod that sleeps cannot accept messages. Either the team pod is always-on — `idleTtlMinutes`
effectively disabled and `LMTHING_SELF_IDLE` unset per-pod — or the first message of the day pays
the wake latency, with the gateway accepting and replaying it (the inbound broker already wakes a
pod and forwards, `cloud/gateway/src/routes/inbound.ts:113-157`). This is the main cost driver of a
team tier and should be a tier field, not a constant.

### 4.12 Client changes

- **Two pods per member.** `COMPUTER_BASE_URL` is a single module-level constant resolved from the
  host (`sdk/org/apps/web/src/lib/config.ts:18`). Every pod call and the WS must instead carry a
  target + token. Mechanical but pervasive: thread a "pod session" instead of a constant.
- **Merged project lists** across the personal pod and each team pod, labelled with team + role.
- **Membership-token lifecycle** alongside the existing refresh in `@lmthing/auth`
  (`sdk/org/libs/auth/src/client.ts#ensureValidToken`); on 403, return to the team list.
- **Read-only affordances** — disabled editors, hidden install/delete, an explicit banner, and a
  clear message when a viewer's agent declines a write. `PodEnsureGate`
  (`sdk/org/apps/web/src/lib/gates.tsx:216`) needs a team variant; it ensures *your* pod today.
- **The `lmthing.team` SPA** becomes a real surface rather than a scaffold.

### 4.13 Documentation

Ships in the same change per the repo contract: `cloud/routes.md` + `cloud/auth.md` (team routes,
`aud:"team"` token), `cloud/billing-and-tiers.md` + `contributing/add-a-tier.md` (team tiers),
`devops/infrastructure.md` (team namespaces and routing), `cli-api/rest/README.md` +
`projects.md` (**the pod now has auth** — the "Auth: none at this layer" section is directly
contradicted), `format/project/api/README.md` (`ctx.actor`), `runtime-globals/` (role-based
capability intersection), and a new team surface doc.

---

## Part 5 — Staging

| Stage | Scope | Ships |
|---|---|---|
| **0** | §4.1 team model + routes + invite/accept UI. No data plane. | Teams exist and are visible. Fully safe. |
| **1** | §4.2 team tier + LiteLLM/Stripe team principal; §4.3 team pod provisioning. | A team pod boots with its own key and budget. Reachable only by its creator. |
| **2** | §4.5 pod principal + allowlist + role gate. Synthetic headers, no external traffic yet. | The pod is safe to expose. Testable in isolation. |
| **3** | §4.4 membership tokens + team routing + team-capable wake. | Members reach the team pod. Projects and spaces work read-only. |
| **4** | §4.6 capability intersection; `editor` enabled. | Read-only is real; write access works. |
| **5** | §4.7 `ctx.actor` + §4.8 realtime seam. | The app platform can host a chat app. |
| **6** | §4.9 chat app + §4.10 THING bridge + §4.11 always-on policy. | The team surface ships. |

Stages 0–4 deliver shared projects and spaces without any chat; 5–6 add the surface. If the chat is
the priority, 5 can move earlier — it is independent of routing — but 2 must always precede 3.

---

## Part 6 — Open decisions

1. **Does a `viewer` get the Studio IDE, or only chat + the app?** Studio exposes raw space files and
   app admin; a viewer arguably wants neither.
2. **How much channel history does THING see** (§4.10)?
3. **May an `editor` install spaces/apps onto the team pod?** It writes team disk and pulls in code
   no one reviewed, and that code runs with team credentials (§4.2).
4. **Team pod sizing curve and `maxMembers` per tier** (§4.2).
5. **Always-on by default, or wake-on-first-message?** (§4.11) — the main cost driver.
6. **Do personal projects move into a team?** A copy is easy; a move raises id collisions, since
   slug-uniqueness and `RESERVED_PROJECT_IDS` are per-root.
7. **Instant revocation?** If yes, `ext_authz`; if "within a minute" is fine, short-TTL tokens plus
   pod re-validation is simpler and cheaper.

---

## Part 7 — Summary

The team pod is the right shape. It makes a team a first-class principal with its own pod, tier,
env and storage, which deletes the entire shared-volume problem — namespaced PVCs, ReadWriteMany,
`local-path`, WAL SQLite, mount churn and duplicated automation all stop applying (§2.6). It also
makes the chat surface cheaper than a gateway-hosted one, because a single Node process fans out
in memory.

What it costs is that multi-user access moves rather than disappears, and one elegant property is
lost: read-only can no longer be enforced by a kernel mount. So the work is:

1. A team model, tier and pod-provisioning path in the gateway — broad but mechanical.
2. Membership-keyed routing at the edge — small in code, high in blast radius.
3. **Authentication and authorization inside the pod, which today has none** — the largest and most
   safety-critical item, and a hard prerequisite for every stage after it.
4. Role-aware capability intersection, because read-only cannot be enforced over HTTP alone —
   running an agent *is* writing.
5. Caller identity in the app runtime and a realtime seam — both currently absent, both now on the
   critical path, and both valuable to every app rather than just to chat.
6. A chat app and a first-party integration space, which reuse existing machinery almost entirely.

The single highest-value next step remains **§4.5 (pod auth)**: it gates everything, it is
independently testable, and it closes a real hole in the current architecture regardless of whether
teams ship.
