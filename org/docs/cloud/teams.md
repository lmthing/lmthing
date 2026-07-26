# Teams

A **team** is a shared lmthing workspace that several people use with their own accounts. It is
its own thing, not a share of someone's: a team gets its own compute pod, its own subscription
tier and its own credentials, so nothing a team spends is billed to a member and no member's
personal keys are involved.

This page documents the **control plane** — the tables, the routes and the team-scoped token.
The design intent is in the repo's `design/teams.md`.

## The principal model

A team is a second kind of *principal* alongside a user. Its principal key is `team-<teamId>`
`cloud/gateway/src/routes/teams.ts#teamPrincipalKey`, and that one string is simultaneously:

- the team's **LiteLLM user id** (its budget and its virtual key hang off it);
- the team's **K8s namespace** (`team-<id>` — the pod the edge routes members to);
- the value written into the existing `user_id`-keyed gateway tables (cron jobs, webhook
  bindings) when the row belongs to a team.

Because a user's principal key is their bare id, every table, key alias and scoped token keeps
working unchanged while teams slot in beside them.

**Tier truth for a team lives in LiteLLM user metadata for `team-<id>`**, exactly as it does for
users — there is deliberately no `tier` column on `teams` to drift from it
`cloud/migrations/010_teams.sql:1-16`.

## Tables

Three tables, created by `cloud/migrations/010_teams.sql` and mirrored idempotently in
`ensureSchema()` `cloud/gateway/src/lib/db.ts#ensureSchema`:

| Table | Key | Holds |
|---|---|---|
| `teams` | `id uuid` | name, `created_by`, `stripe_customer_id` (unique) |
| `team_members` | `(team_id, user_id)` | `email`, `role` (`viewer`\|`editor`), `invited_by` |
| `team_invites` | `id uuid` | `team_id`, lowercased `email`, `role`, `expires_at` (14 days), `accepted_at` |

- `team_members.email` is **denormalized at add/accept time** so the roster and pod-side message
  attribution never need an N-lookup round trip to Zitadel `cloud/migrations/010_teams.sql:26-29`.
- A partial unique index keeps at most one *pending* invite per (team, email)
  `cloud/migrations/010_teams.sql:55-56`.
- Both member tables cascade from `teams`, so deleting a team removes its membership
  `cloud/gateway/src/lib/db.ts#deleteTeam`.

### The last-editor rule

A team with only viewers could never be configured or billed again, so both role-change and
removal refuse to strand a team without an editor. The check and the write happen in one
transaction (`SELECT … FOR UPDATE` on the other editors) so two concurrent demotions can't race
past it `cloud/gateway/src/lib/db.ts#updateTeamMemberRole`,
`cloud/gateway/src/lib/db.ts#removeTeamMember`. Routes surface the refusal as **409**
`cloud/gateway/src/routes/teams.ts:283-284`.

## The team-scoped token

A browser on lmthing.team cannot present a personal access token: the edge routes by JWT claim,
and a personal token resolves to the member's *own* pod. `POST /api/teams/:teamId/token` mints a
team-scoped token after checking membership `cloud/gateway/src/routes/teams.ts:353-367`:

| Claim | Value |
|---|---|
| `sub` | the member's user id |
| `email` | the member's email |
| `team` | the team id |
| `role` | `viewer` or `editor`, read from the DB **at mint time** |

Signed HS256 with the same `GATEWAY_JWT_SECRET` as every other gateway token, TTL **1 hour**
`cloud/gateway/src/lib/tokens.ts#signTeamToken`. `verifyTeamToken` requires a string `team` claim
and a known role, so a personal token can never satisfy it
`cloud/gateway/src/lib/tokens.ts#verifyTeamToken`.

The short TTL is the propagation mechanism: a role change or a removal takes effect on the next
silent re-mint rather than lingering for a browser session.

> A team token also satisfies `verifyAccessToken`, since it carries `sub` and `email`
> `cloud/gateway/src/lib/tokens.ts#verifyAccessToken`. That grants nothing beyond the member's
> own identity, which they already hold — `sub` is always the member, never the team.

## Routes — `/api/teams/*`

Router `cloud/gateway/src/routes/teams.ts`, mounted at `/api/teams`
`cloud/gateway/src/index.ts:40`. `authMiddleware` is applied to the whole router
`cloud/gateway/src/routes/teams.ts:38`: these are control-plane routes and take a **personal**
access token — they are about which teams you belong to. Reaching the team's pod is the separate
step above.

Every route resolves membership through `requireMember(c, teamId, minRole?)`
`cloud/gateway/src/routes/teams.ts#requireMember`. A team id in a URL grants nothing on its own,
and a non-member gets the same **404** whether or not the team exists — team ids are not
probeable.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/teams` | any | Create a team; the creator becomes its first editor |
| GET | `/api/teams` | any | Teams the caller is on + invites addressed to their email |
| GET | `/api/teams/:teamId` | member | Team, roster and pending invites |
| PUT | `/api/teams/:teamId` | editor | Rename |
| POST | `/api/teams/:teamId/members` | editor | Add by email, or record an invite |
| PUT | `/api/teams/:teamId/members/:userId` | editor | Change a member's role |
| DELETE | `/api/teams/:teamId/members/:userId` | editor, **or self** | Remove a member / leave |
| DELETE | `/api/teams/:teamId/invites/:inviteId` | editor | Revoke a pending invite |
| POST | `/api/teams/invites/:inviteId/accept` | any | Claim an invite addressed to your email |
| POST | `/api/teams/:teamId/token` | member | Mint the team-scoped token |

### Creation

`POST /` requires a non-blank `name` of at most 100 characters
`cloud/gateway/src/routes/teams.ts:116-121`. The row is written first, because it mints the id
the other principals are keyed on, and it is the only part that must not fail silently
`cloud/gateway/src/routes/teams.ts:124-130`. Creating the team and seating its creator as the
first editor happen in one transaction `cloud/gateway/src/lib/db.ts#createTeam`.

`provisionTeam` then gives the team its own billing identity and LLM budget — a Stripe customer
carrying `metadata.team_id` and a free-tier LiteLLM user keyed `team-<id>`
`cloud/gateway/src/routes/teams.ts#provisionTeam`. Both are **best-effort**: a team whose
provisioning half-failed is still usable and is repaired on the next compute ensure, so a Stripe
blip doesn't strand the caller.

### Adding people

`POST /:teamId/members` takes `{email, role}` (role defaults to `viewer`, the least privilege)
and branches on whether that email already has an account `cloud/gateway/src/routes/teams.ts:226-265`:

- **It does** (`zitadel.getUserByEmail` resolves) → they become a member immediately, returning
  `{status:"added"}`.
- **It doesn't** → a pending invite row, returning `{status:"invited"}`.

**There is no mailer in this repo.** An invite is claimed on next login: the inviter shares the
lmthing.team link out of band, the invitee signs up through the existing flows, and
`GET /api/teams` surfaces the invites addressed to their session email
`cloud/gateway/src/routes/teams.ts:148-170`.

`POST /invites/:inviteId/accept` is deliberately **not** under `/:teamId` — accepting is what
makes you a member, so it cannot sit behind `requireMember`. The invite id is the capability, and
the addressee, expiry and single-use stamp are all re-checked inside one transaction so a
double-click can't half-apply it `cloud/gateway/src/lib/db.ts#acceptTeamInvite`.

## Billing

A team pays for itself. Its Stripe customer and its LiteLLM principal are both
the team's own, so a subscription bought for a team never touches a member's
card, and the budget it buys is spent by the team's pod rather than by whoever
happens to be typing.

`POST /:teamId/billing/checkout` (editor) creates an embedded Checkout session
against the team's customer, with `subscription_data.metadata = {team_id, tier}`
— **`team_id` and no `user_id`** `cloud/gateway/src/routes/teams.ts#ensureTeamCustomer`.
That is the whole mechanism that keeps team and personal billing apart: the
Stripe webhook resolves a subscription to a principal by looking for `team_id`
first and `user_id` second `cloud/gateway/src/routes/webhook.ts#subscriptionPrincipal`,
and everything downstream — the LiteLLM tier update, the pod resize, the
teardown on cancellation — is keyed on that principal, so both kinds flow
through one code path `cloud/gateway/src/routes/webhook.ts:54-94`.

`GET /:teamId/billing/usage` is readable by **any member**: what the team is
spending is the team's business, even though only an editor can change the plan.

Cancelling a team's subscription downgrades it to free and deletes its pod
`cloud/gateway/src/routes/webhook.ts:96-125`; the next member to open the team
re-provisions it on the free tier, exactly as a user's pod does.

`DELETE /:teamId` (editor) refuses with **409** while a subscription is still
active — deleting the row would orphan a live subscription that nothing would
then downgrade or cancel. It tears down the pod *before* the row, so a failure
leaves a team that can be retried rather than a running namespace nothing owns.

## Verifying it end to end

Most of the model is unit-tested, but three things only a live deployment can
prove: that the edge routes a team token to the team's pod and refuses a
personal one, that a viewer really is read-only *inside* the workspace, and that
THING remembers a channel thread across two different members.

`devops/scripts/verify-teams.sh` walks exactly that, against a real deployment:
it registers two accounts, creates a team, adds one as a viewer, mints both
team tokens and asserts their claims, provisions the pod, then checks the role
matrix through the edge, posts an `@thing` mention as one member and a follow-up
in the same thread as the *other*, and asserts the answer still contains the
word only the first message mentioned. It finishes by scaling the team pod to
zero and confirming the activator wakes it.

```bash
GATEWAY_JWT_SECRET=$(…from the lmthing-secrets k8s secret…) \
  ./devops/scripts/verify-teams.sh
```

It mints its own session JWTs because password login is disabled in production
(`.issues/zitadel-password-login-disabled.md`). Set `SKIP_WAKE=1` to skip the
step that needs cluster access.

The edge Lua itself is checked without a cluster by
`devops/scripts/test-team-lua.py`, which runs the real routing script against a
stubbed request handle.

## Cross-references

- Token shapes and the middleware → [./auth.md](./auth.md)
- The full gateway route table → [./routes.md](./routes.md)
- Tiers and budget windows (the same machinery a team's principal uses) →
  [./billing-and-tiers.md](./billing-and-tiers.md)
