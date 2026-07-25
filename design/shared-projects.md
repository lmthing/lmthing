# Shared workspaces — multi-user access to a project or a space

**Status: research / design proposal. None of the "what must be built" sections exist today.**

This document answers: *what is needed so a user can share a **project** — or a **single space** —
with other lmthing users, who then use it with their own accounts, some read-only (use the spaces and
the app, but change nothing), some with write access?*

The working model that emerged is a **team**: a named group with its own storage, which each member
mounts into their own pod read-only or read-write, using **their own** env keys and their own LLM
budget. Part 5 evaluates that model; Part 6 lists what blocks it.

Part 1 is grounded in the current code (every claim cited). Parts 2–9 are design.

> Convention: `org/docs/` is the source of truth for what **is**. This file is deliberately outside
> it because it describes what **isn't** yet. When any of this ships, the facts move into
> `org/docs/` per [`org/docs/SYNC.md`](../org/docs/SYNC.md) and the matching section here is deleted.

---

## Part 1 — Where we are today

### 1.1 There is no sharing model anywhere in the system

- No membership, ACL, role, invite, team or share table exists in the gateway's Postgres schema. Its
  own tables are `profiles`, `sso_codes`, `backup_config`, `user_cron_jobs`, `webhook_bindings`,
  `controller_ticks` (`cloud/gateway/src/lib/db.ts#ensureSchema`; `cloud/migrations/001..009`).
- No gateway route grants or checks access to another user's resources
  (`cloud/gateway/src/index.ts:28-38`; `org/docs/cloud/routes.md`).
- `lmthing.team` — where this would naturally live — is an empty route scaffold: "There is no room
  backend, no shared VFS and no membership model" (`team/README.md`).
- The pod's project API has no owner, ACL or visibility field. `ProjectMeta` is
  `{ id, name, createdAt }` (`sdk/org/libs/cli/src/server/projects.ts#ProjectMeta`).

Greenfield, not a half-built feature.

### 1.2 Identity **is** the tenancy boundary

lmthing is not a multi-tenant application over a shared database. It is **one single-tenant runtime
per user**, and the user's identity is literally the routing key to that runtime. Four layers assume
"the caller is the owner".

**Layer 1 — Edge routing derives the destination pod from the JWT subject.** Envoy validates the
gateway-issued HS256 JWT and projects `sub` into an `x-user-id` header
(`devops/argocd/envoy/chat-policies.yaml:118-139`, and the identical `studio-`/`computer-`/`app-`
policies); a Lua filter builds the upstream from it:

```lua
local user_id = request_handle:headers():get("x-user-id")
local upstream = "lmthing.user-" .. user_id .. ".svc.cluster.local:8080"
```
(`devops/argocd/envoy/chat-policies.yaml:26-44`)

No authorization step — no `ext_authz`, no policy lookup. **Who you are** and **which pod you reach**
are the same value. There is no way to express "route me to Alice's pod".

**Layer 2 — The pod has no authentication at all.** "The pod server has no authentication of its own.
There is no token check and no auth middleware" (`org/docs/cli-api/rest/README.md`, grounded at
`sdk/org/libs/cli/src/server/serve.ts:L343-L370`). Reaching the port *is* full authority:

| Surface | What it grants | Citation |
|---|---|---|
| `WS /api/terminals/:termId` | An interactive **shell**, cwd = the runtime root | `sdk/org/libs/cli/src/server/ws/terminal.ts#handleTerminalWsUpgrade` |
| `GET/PUT /api/fs/*` | Read/write **any file** under the runtime root | `sdk/org/libs/cli/src/server/routes/fs.ts` |
| `GET/PUT /api/env` | Read and replace the pod `.env` — **every secret** | `sdk/org/libs/cli/src/server/routes/env.ts#handleEnvPut` |
| `GET /api/projects` | **Every** project on the pod | `sdk/org/libs/cli/src/server/projects.ts#listProjects` |
| `PUT .../spaces/:id/files` | **Wipe-and-rewrite** a whole space directory | `sdk/org/libs/cli/src/server/routes/projects.ts#handlePutProjectSpaceFiles` |
| `POST /api/restart` | Kill the process | `sdk/org/libs/cli/src/server/serve.ts:143-147` |

Any design that lets a second person's *traffic* reach a pod must first give the pod an auth layer.
A design that instead moves *files* into the guest's own pod avoids this entirely — see Part 3.

**Layer 3 — One pod, one LiteLLM key, one payer.** The gateway fetches the owner's LiteLLM virtual
key and injects it into the pod's `user-env` secret at create time
(`cloud/gateway/src/lib/compute.ts:583-600`, via `getLiteLLMKey` at `:312` and `litellmEnvDefaults`
at `:343`). There is no per-request key. Pod size comes from the owner's tier
(`cloud/gateway/src/lib/tiers.ts`); concurrent sessions are capped pod-wide by `MAX_SESSIONS`,
default 24 (`sdk/org/libs/cli/src/server/session-manager.ts:296`).

**Layer 4 — The project-app runtime has no request identity.** Dispatch is
`runtime.handle(method, path, input)` — no principal, no headers, no session
(`sdk/org/libs/cli/src/server/routes/app-api.ts:53`). The Envoy comment says it outright: "A
project-app is SINGLE-USER and has no auth of its own — the only auth here is the PLATFORM picking
which pod" (`devops/argocd/envoy/app-policies.yaml:1-9`).

### 1.3 A project is a directory, not an addressable object

`<root>/<projectId>/` on the owner's 1 Gi PVC — `project.json`, `instructions.md`, `documents/`,
`spaces/`, `sessions/`, plus the app pillars `database/ api/ pages/ hooks/ components/ events/`
(`org/docs/cli-api/rest/projects.md`, `org/docs/format/project/README.md`). Its database is
`<project>/.data/app.db` (`sdk/org/libs/cli/src/app/store.ts`).

Two consequences that matter later:

- **Agent sessions live inside the project** — `<root>/<projectId>/sessions/` and
  `<root>/<projectId>/spaces/<spaceId>/sessions/`
  (`sdk/org/libs/cli/src/server/projects.ts#sessionsDir`, `#spaceSessionsDir`). Shared storage means
  shared transcripts unless partitioned.
- **Project discovery is purely structural** — `listProjects` returns every subdirectory of `<root>`
  with a readable `project.json` (`sdk/org/libs/cli/src/server/projects.ts#listProjects`). Anything
  mounted into that shape simply *appears* as a project, with no code change.

### 1.4 A space is portable, but it is not a unit of isolation at runtime

A space is a self-contained bundle — `agents/ functions/ components/ tasklists/ knowledge/ events/`
— loaded by `loadSpace(dir)` (`sdk/org/libs/core/src/spaces/load.ts#loadSpace`), resolved from two
roots only: `<root>/system/spaces/` and `<root>/<projectId>/spaces/`
(`org/docs/format/space/README.md`). It is already the system's distribution unit: the store ships
spaces, and `POST /api/store/spaces/install` materializes one into
`<root>/<projectId>/spaces/<spaceId>/` behind a pristine-vs-diverged hash guard
(`sdk/org/libs/cli/src/server/routes/store-spaces.ts#installStoreSpace`).

But a space does **not** isolate at runtime. Four couplings:

- **A session is always project-scoped.** `spaceDir` is `join(root, projectId)` — the whole project
  loaded as a space (`sdk/org/libs/cli/src/server/session-manager.ts:1199`, `:1266`). `spaceRef`
  only picks the agent and where sessions persist. Running "just a space's agent" still loads the
  project context and every system space.
- **Capabilities target the host project's database.** `capabilities:` grants `db:read`/`db:write`
  narrowed to table *names* (`sdk/org/libs/core/src/spaces/capabilities.ts#parseCapabilities`),
  resolved against whichever project the space sits in. The space itself says nothing about what
  data it will touch.
- **Delegation and deps reach outward** — `canDelegateTo` (`load.ts:477-481`) and `dependentSpaces`
  (`load.ts:617-650`) can reach other agents and spaces in the host project.
- **Integration credentials are not in the space.** Settings are read from **pod env**;
  `missingRequired` is computed against `process.env`
  (`sdk/org/libs/cli/src/server/routes/store-spaces.ts:479-491`). A shared integration space carries
  no connection — the recipient must supply their own.

So a space travels well as *code*, and badly as *a scope*.

### 1.5 The storage layer — what it can and cannot express

This decides the whole feature.

- **Every user pod gets one PVC, `user-data`, `accessModes: ["ReadWriteOnce"]`, 1 Gi, no
  `storageClassName`** (`cloud/gateway/src/lib/compute.ts:164-179`), mounted at `/data`
  (`compute.ts:243`) from `persistentVolumeClaim: { claimName: "user-data" }` (`compute.ts:262-267`).
- **The default StorageClass is `local-path`** (`rancher.io/local-path`) — and nothing in this repo
  provisions it. `org/docs/devops/infrastructure.md` (Storage) flags this as an open infra bug: the
  class was applied by hand, carries no Helm release or ArgoCD ownership, and a cluster rebuilt from
  this repo would have no default class at all. local-path is a **node-local hostPath provisioner**:
  it cannot do `ReadWriteMany`, and its PV is a directory on exactly one node.
- **Production is single-node today** — `node1`, a control-plane node that also runs workloads
  (`org/docs/devops/infrastructure.md:3,61-65`), with an optional dedicated `lmthing-user-pool-1`
  worker pool behind `enable_user_pool` (`devops/terraform/variables.tf:82-97`). So *today*, every
  user pod is co-scheduled by accident of topology.
- **PVCs are namespaced.** A pod may only reference a PVC in its own namespace, and user pods live
  in `user-<id>` namespaces (`compute.ts#createUserPod`). Kubernetes has no cross-namespace volume
  mount.
- **The project database is SQLite in WAL mode** — `PRAGMA journal_mode = WAL`
  (`sdk/org/libs/cli/src/app/store.ts:298-300`). SQLite documents that WAL requires a shared-memory
  `-shm` file and does not work over network filesystems.
- **The project tree must be writable to be served.** The page build emits into
  `<projectRoot>/.data/pages-dist/`, `.data/pages-build/` and `.data/pages-cache.json`
  (`sdk/org/libs/cli/src/app/build/pages.ts:73-75,138`); `emitter-state.json`
  (`sdk/org/libs/cli/src/server/emitter-state.ts:46`) and `hooks-state.json`
  (`sdk/org/libs/cli/src/server/routes/hooks.ts:538`) live under the same `.data/`.
- **Pod-template patches roll the pod.** `compute.ts` deliberately puts the last-active annotation on
  Deployment metadata, "never the pod template (a template patch would trigger a rolling restart)"
  (`compute.ts:246-249`). Adding or removing a volume mount *is* a template patch.

### 1.6 Automation is registered per user, not per project

Each pod publishes its full cron schedule to the gateway, which stores it **per userId**, keyed
`projectId/slug` (`replaceCronManifest(userId, …)`, `cloud/gateway/src/routes/compute.ts:89-134`);
an always-on tick wakes the pod at each due `next_run_at`. Inbound webhook bindings work the same way
(`POST /api/compute/webhook-manifest`, `compute.ts:142-177`). Nothing deduplicates across users.

### 1.7 Existing primitives worth reusing

| Primitive | Why it's relevant |
|---|---|
| **Audience-scoped JWTs** — `signComputeToken`/`signBackupToken`/`signInboundToken`, `aud`-pinned, subject authoritative (`cloud/gateway/src/lib/tokens.ts:56-194`) | The shape a team/grant credential needs. |
| **GitHub backup** — the whole workspace pushed to a repo via a gateway-minted, repo-scoped App token (`cloud/gateway/src/routes/backup.ts`) | A working replication channel; the basis of the git-backed team (Part 3C). |
| **Store install** — catalog fetch + per-file download + pristine-vs-diverged hash guard (`sdk/org/libs/cli/src/server/routes/store-spaces.ts#downloadStoreSpace`, `#installStoreSpace`); base URL overridable via `LM_STORE_URL` (`store-spaces.ts:40-44`) | A private team registry could speak the same catalog shape and reuse the existing install engine. Note the download `fetch` carries no credentials today. |
| **Capabilities** — 14 grant ids gating every write global, driving both injection and the typecheck DTS (`sdk/org/libs/core/src/spaces/capabilities.ts#CAPABILITY_IDS`) | The only place read-only can be enforced for *agent execution* (Part 7.4). |
| **`x-user-id` already reaches the pod** — Envoy adds it; the Lua never removes it; no pod code reads it (no hits in `sdk/org/libs/{cli,core}` or `apps/web`) | A pre-existing seam for delivering caller identity, if ever needed. |

---

## Part 2 — The two units are not the same problem

| | **Project** | **Space** |
|---|---|---|
| What it is | Data + a served application | Code + persona |
| Has a database | Yes (`.data/app.db`) | No |
| Already portable | No | **Yes** — the store distributes spaces |
| Meaningful shared read-only | Only live (a copy of data is stale) | A copy is usually fine |
| Hard part | Concurrent data, per-user identity in the app | Runtime coupling to the host project (§1.4) |

**A shared space is mostly a distribution problem. A shared project is a concurrency problem.**
Trying to serve both with one mechanism is what makes this feature look harder than it is.

---

## Part 3 — Topology options

### A. Route the traffic — guests reach the owner's pod

- ✅ True live state; one copy of the data.
- ❌ Requires an authorization plane at the edge **and** an auth layer inside the pod (§1.2).
- ❌ Owner pays all guest LLM spend and hosts all guest load on their tier's pod.

### B. Move the files — a team volume, mounted by each member's pod

- ✅ Each member runs in their **own** pod with their **own** LiteLLM key and their own CPU/memory.
  Billing and capacity stop being a problem.
- ✅ No routing change at all — Envoy's `sub` → `user-<id>` Lua is untouched.
- ✅ Read-only is **kernel-enforced** by `readOnly: true` on the volumeMount, which survives the pod
  having no auth and handing out a shell.
- ✅ Discovery is nearly free — mount at `<root>/<projectId>/` and it appears as a project (§1.3).
- ❌ Blocked by the storage chain in Part 6.

### C. Replicate the files — a git-backed team volume

Each member's pod clones and syncs, reusing the backup machinery (`cloud/gateway/src/routes/backup.ts`).

- ✅ No namespace problem, no RWX requirement, no WAL problem.
- ✅ Real conflict handling, history and revert; read-only is simply "no push token".
- ❌ Eventually consistent — wrong for two people editing simultaneously.
- ❌ Each member gets their own database — fine for spaces, wrong for a shared app.

### D. Copy / fork

Reuses the store install path. Not sharing; useful as *publishing*.

**Recommendation: C for spaces, B for projects with a live app.** They are different enough that one
mechanism serving both is a false economy.

---

## Part 4 — The team model

A **team** is a named group with its own storage. Each member mounts it into their own pod, read-only
or read-write, and uses their own env keys and their own LLM budget.

This is the right *unit* regardless of which transport (B or C) backs it:

- **It is a real trust boundary.** "Members trust each other's code" is a defensible policy — it is
  how a shared git repo plus CI already works. It converts the code-execution risk below from a hole
  into a stated assumption.
- **Mounts are bounded and stable.** A user belongs to a few teams, not N shares, so mount count
  stops growing with sharing activity and the pod-restart churn from template patches (§1.5) mostly
  disappears.
- **Read vs write per member is the right granularity**, and it maps onto a kernel-enforced mount
  flag rather than an HTTP role gate.
- **Per-user env keys are correct** — no shared credential pool, no ambiguity about whose Slack
  account an integration is using.

### 4.1 What per-user env keys do *not* fix

Per-user keys solve credential *pooling*, not code *trust*, and the distinction matters.

The team volume carries `api/`, `hooks/`, `events/` and tasklist code nodes — all executable. API
handlers launch as `new NodeWorker(source, { eval: true, workerData: job })` with **no `env`
option** (`sdk/org/libs/cli/src/app/api/runtime.ts:296`), so they inherit `process.env`; hooks run
in-process. When Bob mounts the team volume, Bob's pod executes team code **with Bob's own keys** —
which is exactly what "env keys come from the user account" specifies. The keys are not shared; the
*exposure* is. **Any member who can write to the team volume can read every other member's
environment on their next mount.**

Acceptable inside a mutual-trust team. Not acceptable for a read-only member, who would implicitly
be trusting every writer with their credentials — the inverse of what "read-only" implies. Mitigations
worth designing in: scrub or allow-list the worker env for team-mounted code, and state the trust
relationship in the invite flow.

---

## Part 5 — Blockers for the mounted team (Option B)

The chain, in order — each step forced by the previous one:

1. **A "team PVC" cannot be one PVC.** PVCs are namespaced and pods may only reference a claim in
   their own namespace (§1.5); members live in separate `user-<id>` namespaces. It must be **one PVC
   per member namespace, statically bound to the same underlying PV**.
2. **That requires `ReadWriteMany`.** The current class is `local-path` — node-local hostPath, RWO
   only (§1.5). It physically cannot back a multi-namespace shared volume.
3. **RWX means network storage (NFS / Azure Files / CephFS / Longhorn), which breaks the database.**
   The project db runs `journal_mode = WAL`, and WAL does not work over network filesystems (§1.5).
   The inversion worth naming: **local-path is the only storage that makes shared SQLite safe, and
   it is also the only one that cannot span nodes.** Multi-node or a shared database — not both.
4. **Even where it works, multi-writer SQLite is a lock, not a concurrency model** — one writer at a
   time, `SQLITE_BUSY` under contention.
5. **Read-only members cannot read the database or open the app.** A WAL reader must write the
   `-wal`/`-shm` sidecars, so a read-only mount fails; and the tree must be writable to be *served*
   at all (`.data/pages-dist`, `pages-build`, `pages-cache.json`, `emitter-state.json`,
   `hooks-state.json` — §1.5). This defeats the primary use case.
6. **Automation runs once per member.** Five members mounting a project with one cron hook produce
   five per-user manifests, five wake-ups and five executions (§1.6). A team needs a **designated
   executor**; nothing in the current model can express that.
7. **Concurrent editors have no coordination.** The bulk space-file `PUT` is documented as
   non-atomic — "the target dir is `rm -rf`'d and rewritten… a crash mid-write leaves a partial
   tree" (`org/docs/cli-api/rest/projects.md`). Lost updates and torn reads.
8. **Scheduling coupling.** While on local-path, every member's pod must be co-scheduled on the PV's
   node. True by accident today (single-node), false the moment a second node or the user pool exists
   — at which point team membership becomes a pod-scheduling constraint.

Items 5 and 6 are solvable and on the critical path for **every** version of this feature:

- **Relocate per-user derived state out of the shared tree** — build output, caches, emitter and hook
  state move under the member's own PVC, keyed by project. A well-scoped layout refactor.
- **Take the shared db out of WAL, or serve reads through the executor pod's API.**
- **Designate one member's pod as the automation executor**; hooks inert on every other mount.

---

## Part 6 — What must be built

### 6.1 Team model in the gateway

New tables, following the `ensureSchema()` + `cloud/migrations/NNN_*.sql` pattern:

```sql
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_id    text NOT NULL,
  executor_id text,                    -- member whose pod runs cron/hooks (§5.6)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE team_members (
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   text,                      -- NULL until the invite is accepted
  email     text,
  access    text NOT NULL,             -- 'read' | 'write'
  status    text NOT NULL,             -- 'pending' | 'active' | 'removed'
  PRIMARY KEY (team_id, user_id)
);
```

Routes (all `authMiddleware`): `GET /api/teams` (mine), `POST /api/teams`,
`POST /api/teams/:id/members`, `PATCH /api/teams/:id/members/:userId` (access), `DELETE` (remove),
`POST /api/teams/:id/accept`, `PATCH /api/teams/:id` (executor). Email→user-id resolution already
exists via `zitadel.getUserByEmail` (`cloud/gateway/src/lib/zitadel.ts`).

### 6.2 Storage provisioning (Option B)

An RWX StorageClass; a `teams` namespace holding the PV; per-member PVCs statically bound via
`volumeName`; a reconciler that patches each member's Deployment volumes/volumeMounts on membership
or access change, with `readOnly: true` for `read` members. Note this rolls the member's pod (§1.5).

### 6.3 Project-layout refactor (required either way)

Move per-user derived state out of the shared tree (§5, items 5–6): page build output, caches,
emitter state, hooks state. Decide the shared-db strategy (out of WAL, or reads via the executor).

### 6.4 Multi-root project discovery

`listProjects` scans `<root>` only (§1.3). Mounting a team at `<root>/<projectId>/` needs no change;
mounting several team projects under one team volume needs `subPath` mounts or a second scan root.

### 6.5 Read-only enforcement in the runtime

The mount flag stops filesystem writes, but **running an agent is itself a write** — a `read` member's
turn can still `db.insert`, install a space, write knowledge, emit events, persist a transcript, and
spend their own budget. A `read` member's session must additionally **intersect the agent's
`CapabilityProfile`**, stripping `db:write`, `db:schema`, `pages:write`, `api:write`, `hooks:write`,
`knowledge:write`, `store:install`, `project:manage`, `fs:scratch`. Because the profile drives both
injection and the typecheck DTS (`sdk/org/libs/core/src/exec/bootstrap.ts:L99`), a stripped grant
fails typecheck and the model retries differently instead of throwing — the behaviour we want. Accept
that a read-only member gets a deliberately degraded agent, and surface that in the UI.

### 6.6 Worker env hygiene

Scrub or allow-list `process.env` for team-mounted `api/`/`hooks/` code (§4.1).

### 6.7 The shared app still has no per-user identity

`runtime.handle(method, path, input)` takes no principal (`routes/app-api.ts:53`). Storage location
does not tell you who is calling. Threading an actor into `ctx`, declaring endpoints read-only, and
row-level ownership are separate work — and out of scope for v1, stated as a known limitation.

### 6.8 SPA

Team list and membership UI; project list becomes a union of own + team projects, labelled with team
and access; read-only affordances (disabled editors, hidden install/delete, an explicit banner, and a
clear message when a read member's agent declines a write).

### 6.9 Documentation

Ships with `org/docs/` updates in the same change: `cloud/routes.md` + `cloud/auth.md`,
`devops/infrastructure.md` (storage class, the team volume), `cli-api/rest/projects.md`,
`format/project/README.md` (layout refactor), `runtime-globals/` (capability intersection), `studio/`.

---

## Part 7 — Suggested staging

| Stage | Scope | Ships |
|---|---|---|
| **0** | §6.1 team model + invite/accept UI. No data-plane change. | Teams exist; membership is visible. Fully safe. |
| **1** | §6.3 project-layout refactor — per-user derived state out of the shared tree. | Prerequisite for every option; independently valuable. |
| **2** | Option **C** (git-backed) for **spaces** only. | Shared spaces working end to end, no infra change. |
| **3** | §6.5 capability intersection for `read` members; §6.6 env hygiene. | Read-only is real, not just filesystem-shaped. |
| **4** | §6.2 RWX class + team volume + §5.6 designated executor. | Live shared projects. |
| **5** | §6.7 app actor identity. | Shared apps with per-user data. |

Stages 0–3 need **no** storage-class change and deliver the space use case completely. Stage 4 is
where the infra work concentrates; treat it as a separate decision once 0–3 are in.

---

## Part 8 — Decisions needed

1. **Spaces via git-sync, projects via mount — or one mechanism for both?** (Part 3)
2. **Is a team a mutual-trust boundary for code execution?** If yes, §4.1 is a documented assumption;
   if no, worker env scrubbing becomes a blocker, not a mitigation.
3. **Are read-only members inside or outside that trust boundary?** They currently must trust every
   writer with their own env keys.
4. **Shared-database strategy** — out of WAL, or reads routed through the executor pod? (§5.3–5.5)
5. **Who is the automation executor, and what happens when their pod is asleep?** (§5.6)
6. **Are team members' chat transcripts private from each other?** They persist inside the project
   (§1.3).
7. **Does a team have its own tier/quota**, or does each member's own tier govern? Storage size and
   who pays for the team volume.
8. **Is multi-node scale-out a requirement?** If yes, local-path is disqualified and §5.2–5.3 must be
   solved. If a single node is acceptable for the foreseeable future, Option B gets much cheaper.

---

## Part 9 — Summary

Sharing is not a project-layer feature; it is a change to the tenancy model. Today **identity,
routing destination, trust boundary and billing account are all the same value** — the JWT `sub`.

The team model is the right frame: it makes the trust boundary explicit, keeps each member on their
own compute and their own keys, and turns read-only into a kernel-enforced mount flag rather than an
HTTP role gate. Moving *files* rather than *traffic* is the better decomposition, and it deletes the
entire edge-authorization and pod-authentication work area.

What remains is concentrated and specific:

1. **Storage cannot express a shared volume today.** PVCs are namespaced → one PVC per member → same
   PV → needs RWX → `local-path` cannot → network storage → WAL SQLite breaks. Every path funnels
   through this chokepoint.
2. **Read-only members cannot currently read.** The project tree must be writable to serve its app
   and open its WAL database. Fixing this — relocating per-user derived state — is on the critical
   path for every option and is worth doing first.
3. **Automation would run once per member**; a team needs a designated executor.
4. **Per-user env keys close credential pooling, not code trust.** A writer's code runs in every
   other member's pod with that member's keys.
5. **The shared app still has no per-user identity**, and no storage decision changes that.

The highest-value next step is **§6.3, the project-layout refactor**: it is required by every variant,
it is independently testable, and it is what currently makes "read-only" impossible to implement at
all.
