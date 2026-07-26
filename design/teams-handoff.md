# Teams — state of play, and how to continue

Written 2026-07-26. The feature specified in [`teams.md`](./teams.md) is **implemented, deployed to
lmthing.team, and verified end-to-end against the live cluster** (42/42). This file is the handoff:
what exists, what is deliberately not done yet, and what is broken around it that is *not* teams.

Everything factual about how teams work lives in `org/docs/` — that is the source of truth, and this
file does not duplicate it. Start there:

- [`org/docs/cloud/teams.md`](../org/docs/cloud/teams.md) — the model: principals, tokens, the trust
  boundary, billing.
- [`org/docs/cli-api/rest/team.md`](../org/docs/cli-api/rest/team.md) — the pod's team surface: the
  role gate and the channel routes.
- [`org/docs/cloud/routes.md`](../org/docs/cloud/routes.md) — every `/api/teams/*` gateway route.
- [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md) — the lmthing.team edge.

---

## The one idea worth carrying over

**A team is its own principal, not a share of someone's workspace.** `PodPrincipal` is
`{kind:'user'|'team', id}` (`cloud/gateway/src/lib/compute.ts`). A user's principal key stays their
bare id, which is why every pre-existing row, LiteLLM alias and token kept working while teams slotted
in beside them. A team gets its own pod (`team-<id>` namespace), its own LiteLLM budget
(`team-<id>`), and its own Stripe customer.

**The edge is what keeps teams apart.** `POST /api/teams/:id/token` mints a token carrying `team` and
`role` claims. Envoy on lmthing.team validates it, routes by the `team` claim, and projects
`sub`/`email`/`team`/`role` into headers the pod reads as caller identity — overwriting anything the
client sent. A *personal* token has no team claim and is refused. That single fact is what stops a
member's own pod and their team's from ever crossing.

**The pod is unchanged unless told otherwise.** All team behaviour is inert unless
`LMTHING_TEAM_MODE=1`, which only the gateway sets, and as a **container** env var — not a key in the
editable `user-env` secret, so an editor's replace-all `PUT /env` cannot switch the guard off.

---

## How to verify it still works

```bash
GATEWAY_JWT_SECRET="$(./devops/scripts/cluster-kubectl.sh get secret lmthing-secrets -n lmthing \
  -o 'jsonpath={.data.GATEWAY_JWT_SECRET}' | base64 -d)" \
  ./devops/scripts/verify-teams.sh
```

Takes ~6 minutes (two real THING turns). It registers throwaway accounts, exercises the whole flow,
and deletes the team at the end (`KEEP_TEAM=1` to keep it, `SKIP_WAKE=1` to skip the scale-to-zero
section). Last run: **42 passed, 0 failed**.

Things it proves that no unit test can: that the edge routes a team token to the team's pod and
refuses a personal one, that a viewer is genuinely read-only *inside* the workspace, that the
scale-to-zero activator wakes a team pod, and that **THING remembers a channel thread across two
different members** — A plants a word, B asks for it back in the same thread and gets it.

### Gotchas the script encodes

- **Password policy.** `POST /api/auth/register` rejects weak passwords (`Password must contain upper
  case`). Use the shape in the script.
- **Status must survive a subshell.** `X=$(api ...)` runs the helper in a subshell, so a `STATUS=`
  assignment dies with it and the next assertion grades the *previous* call. Status goes to a file;
  read it with `st()`. This bug reported a successful invite claim as a 403.
- **Team checkout is embedded** (`ui_mode:'embedded'`) — it returns a `client_secret`, not a hosted
  `url`.
- **`#general` is seeded but not necessarily first** once another channel exists — assert presence.

---

## What is deliberately not done

These are design decisions, not omissions to be tidied up. Each has a reason.

| Deferred | Why |
|---|---|
| Team project-**app pages** served at lmthing.team | A document navigation carries no `Authorization` header, so the team token cannot reach the edge. Needs a cookie story like `app-policies.yaml`. The app **API** works today. |
| Team GitHub backup | The install flow is interactive; `GITHUB_BACKUP_*` is deliberately not injected for teams. |
| Live token streaming for THING in a channel | v1 broadcasts a typing indicator and the final message. Streaming is an optional `onTrace` away. |
| Consent-gated capabilities in a channel | Headless runs fail closed on consent, so THING-in-a-channel cannot use a connection that would prompt. Documented, not a bug. |

Role changes propagate on the next token mint (TTL 1h), but the pod reads the role **per request**
from headers — so a re-mint is effective immediately.

---

## Not teams, but in the way

**The static SPA images do not build.** `blog`, `casa`, `com`, `org`, `social`, `space`, `store` and
`scenario-dash` fail on `Cannot find package '@tamagui/core'`. This is the parallel React-Native /
Tamagui migration: `libs/ui` moved from Radix+Tailwind to Tamagui, and those SPAs consume `@lmthing/ui`
without declaring the new peer. **It is not caused by teams** — builds have been red since 05:40 on
2026-07-26, before the first teams commit at 07:12. `gateway`, `compute`, `team`, `chat`, `studio` and
`computer` all build.

Fixing it means adding `@tamagui/core` to those packages, which belongs to whoever lands the migration.

**`pnpm docs:check` has 12 pre-existing failures**, all from the same migration (`ide-editor.tsx` and
friends are now re-export shims). None are teams citations.

**The root lockfile drifts every time the migration touches a `libs/*` manifest.** When a build fails
with `ERR_PNPM_OUTDATED_LOCKFILE`, regenerate it against the submodule commit the parent **pins**, not
the moving worktree HEAD:

```bash
PINNED=$(git ls-tree HEAD sdk/org | awk '{print $3}')
```

Stage the manifests each root-context Dockerfile copies into a scratch dir, run
`pnpm install --lockfile-only --no-frozen-lockfile` there, copy the lockfile back, then validate with
`--frozen-lockfile` against all three manifest sets (web has no `libs/config`; the SPAs do;
scenario-dash adds `automation/app`). The root workspace globs `sdk/org/apps/web` **only** — not
`apps/*` — because no image ever stages `apps/mobile`, and globbing it makes `--frozen-lockfile`
unsatisfiable in one place or the other.

---

## Bugs found by deploying, and what they teach

Every one of these passed unit tests and was only exposed by a live run. Worth knowing when adding to
this feature.

1. **Team pods crash-looped.** The kubelet's startup probe hit `/api/sessions` with no identity
   headers — it comes from inside the cluster, not through Envoy — and a team pod 401s an
   unidentified caller. Now both probes target `/api/health`, the one path in
   `team-guard.ts#PUBLIC_PATHS` served without a caller.
2. **…and then the health route killed the pod anyway.** It was registered as a *synchronous* handler,
   and `Router.dispatch` called `.catch()` on its `undefined` return. The router now wraps handlers in
   `Promise.resolve().then()`, so no handler can take the process down.
3. **Adding a teammate never found them.** Zitadel's v2 search filter field is `emailAddress`; we sent
   `email`. Zitadel does not reject an unknown field — it answers 200 and matches nothing, so every
   lookup said "no such user" and seated everyone as a pending invite. The same bug sat in the GitHub
   sign-in path that links an IDP to a pre-existing email.
4. **The last-editor guard threw instead of guarding.** `SELECT count(*) … FOR UPDATE` is rejected by
   Postgres outright. Role changes and removals 500'd, and the rule protecting a team's last editor
   never once ran. Lock the rows, count them in JS. Guarded now by `db.sql.test.ts`, which reads the
   SQL itself — the route tests mock `db.js` wholesale, so nothing ever sent these statements to a
   server.
5. **`#general` was never seeded once another channel came first.** Seeding keyed off "the list is
   empty", so whichever entry point a fresh team hit first decided whether it ever got one. The
   trigger is now the channels *file* not existing, and every entry point seeds before acting.
6. **A message to a nonexistent channel silently succeeded**, creating an invisible channel whose
   transcript accumulated and broadcast but which nothing ever listed. Now a 404.

The pattern: **mocked unit tests cannot see wiring.** Probe targets, SQL validity, an external API's
field names, and which caller reaches a route first are all invisible to them. When adding to teams,
assume the live run will find something.

---

## Where the code is

| | |
|---|---|
| Gateway control plane | `cloud/gateway/src/routes/teams.ts`, `lib/db.ts`, `lib/tokens.ts`, `lib/compute.ts` |
| Schema | `cloud/migrations/010_teams.sql` (mirrored in `db.ts#ensureSchema`) |
| Edge | `devops/argocd/envoy/team-routes.yaml`, `team-policies.yaml` (Lua harness: `devops/scripts/test-team-lua.py`) |
| Pod | `sdk/org/libs/cli/src/server/team-guard.ts`, `team-channels.ts`, `routes/team-channels.ts`, `ws/team-channels.ts` |
| Frontend | `sdk/org/apps/web/src/routes/team/`, `src/lib/team-auth.tsx`, `src/lib/gates.tsx` |
| E2E | `devops/scripts/verify-teams.sh` |

`lmthing.team` is a surface of the unified web app, exactly like chat/studio/computer: same
`sdk/org/apps/web/Dockerfile`, its own image and `devops/argocd/core/team.yaml`. There is **no
top-level `team/` directory** — the old stub SPA was deleted, and chat/studio don't have one either.

## Suggested next steps

1. **Drive the UI in a browser.** Everything verified so far is API-level. The surface at
   `https://lmthing.team` has never been clicked through; use the chrome-devtools MCP and the
   JWT-mint runbook in the root `CLAUDE.md`.
2. **A real Stripe checkout.** The E2E proves a session is created with the right metadata; nobody has
   completed a payment and watched the webhook resize the team pod.
3. Then the deferred list above, in whatever order matters.
