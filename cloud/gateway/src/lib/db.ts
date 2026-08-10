import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 5 });

// ─── Leader election for singleton controller ticks ───────────────────────────
//
// The gateway runs `replicas: 2`, so any `setInterval` controller (the idle-pod
// sweep and the cron-wake tick in cluster-status.ts) would otherwise fire on
// BOTH replicas each tick. `withLeaderLock` gates a tick behind a Postgres
// session-level advisory lock: only the replica that wins the try-lock runs the
// body; the other skips this tick. It's a try-lock (never blocks), and if the
// leader dies its connection drops and Postgres frees the lock automatically, so
// leadership self-heals on the next tick.

/** Map an arbitrary lock name to a stable 31-bit advisory-lock key (djb2). */
function advisoryKey(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

/**
 * Run `fn` iff this replica acquires the named advisory lock. Returns `fn`'s
 * result, or `undefined` when the lock was already held (this replica is not the
 * leader this tick). The lock + fn + unlock all run on ONE reserved connection so
 * the session-scoped lock releases correctly (a pooled `sql` call could unlock on
 * a different connection than it locked on).
 */
export async function withLeaderLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const k = advisoryKey(key);
  const reserved = await sql.reserve();
  try {
    const [row] = await reserved<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${k}) AS locked
    `;
    if (!row?.locked) return undefined;
    try {
      return await fn();
    } finally {
      try {
        await reserved`SELECT pg_advisory_unlock(${k})`;
      } catch (err) {
        console.warn("[db] pg_advisory_unlock failed:", err);
      }
    }
  } finally {
    reserved.release();
  }
}

/**
 * Claim a singleton controller tick across the 2 gateway replicas. Returns true
 * to at MOST one caller per `minSpacingMs` window, regardless of replica timing.
 *
 * `withLeaderLock` only prevents *simultaneous* execution; the two replicas' 60s
 * `setInterval`s are offset (by their pod-start delta), so each would run its own
 * tick — the controller effectively fires ~2×/interval. This atomic upsert instead
 * records the last claim time and only lets a claim through when enough time has
 * elapsed since the previous one (by any replica), giving true "≈once per tick".
 * A single statement, serialized by the primary-key row lock — no advisory lock.
 */
export async function claimTick(
  key: string,
  minSpacingMs: number,
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO controller_ticks (key, last_run_at)
    VALUES (${key}, now())
    ON CONFLICT (key) DO UPDATE SET last_run_at = now()
      WHERE controller_ticks.last_run_at
            < now() - make_interval(secs => ${minSpacingMs}::float8 / 1000.0)
    RETURNING 1 AS claimed
  `;
  return rows.length > 0;
}

/**
 * Idempotently ensure the gateway's own tables exist. LiteLLM manages its
 * tables automatically in the same schema, but `profiles` and `sso_codes` are
 * ours — mirror of cloud/migrations/{001,002}. Runs on every startup so a fresh
 * or half-migrated database self-heals without depending on the Ansible
 * migration step (which is easy to skip and previously swallowed failures).
 * Keep this in sync with cloud/migrations/*.sql.
 */
export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id text PRIMARY KEY,
      email text NOT NULL,
      stripe_customer_id text UNIQUE,
      tier text NOT NULL DEFAULT 'free',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.sso_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      code text NOT NULL UNIQUE,
      redirect_uri text NOT NULL,
      app text NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sso_codes_code
      ON public.sso_codes (code) WHERE used_at IS NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.backup_config (
      user_id text PRIMARY KEY,
      installation_id text,
      repo text,
      auto boolean NOT NULL DEFAULT false,
      interval_minutes int NOT NULL DEFAULT 60,
      branch text NOT NULL DEFAULT 'lmthing-backup',
      last_backup_at timestamptz,
      last_commit_sha text,
      status text,
      error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Externalized cron: each row is one project-app cron hook for one user, with
  // the wall-clock `next_run_at` the gateway wakes the pod at. Published by the
  // pod (POST /api/compute/cron-manifest); consumed by the cron-wake tick.
  // Mirror of cloud/migrations/006_user_cron_jobs.sql.
  await sql`
    CREATE TABLE IF NOT EXISTS public.user_cron_jobs (
      user_id text NOT NULL,
      project_id text NOT NULL,
      slug text NOT NULL,
      cron_expr text NOT NULL,
      every_ms bigint NOT NULL,
      next_run_at timestamptz NOT NULL,
      last_woken_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, project_id, slug)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_cron_jobs_next_run
      ON public.user_cron_jobs (next_run_at)
  `;
  // Singleton controller-tick coordination across the 2 gateway replicas (claimTick).
  await sql`
    CREATE TABLE IF NOT EXISTS public.controller_ticks (
      key text PRIMARY KEY,
      last_run_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Inbound webhook bindings — the pod publishes its registered webhook hooks
  // (POST /api/compute/webhook-manifest) so the public inbound broker
  // (/api/inbound/:userToken/:path) can list them for the UI. Mirror of
  // cloud/migrations/008_webhook_bindings.sql.
  await sql`
    CREATE TABLE IF NOT EXISTS public.webhook_bindings (
      user_id text NOT NULL,
      path text NOT NULL,
      provider text,
      agent_ref text,
      project_id text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, path)
    )
  `;
  // Teams — shared workspaces with their own pod, tier and credentials. Only
  // membership lives here; tier truth stays in LiteLLM metadata for the
  // `team-<id>` principal. Mirror of cloud/migrations/010_teams.sql.
  await sql`
    CREATE TABLE IF NOT EXISTS public.teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_by text NOT NULL,
      stripe_customer_id text UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.team_members (
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      email text NOT NULL,
      role text NOT NULL CHECK (role IN ('viewer', 'editor')),
      invited_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_team_members_user
      ON public.team_members (user_id)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.team_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text NOT NULL CHECK (role IN ('viewer', 'editor')),
      invited_by text NOT NULL,
      expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
      accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_pending
      ON public.team_invites (team_id, email) WHERE accepted_at IS NULL
  `;
  // Devices a user has asked to be notified on. One row per device, not per
  // user: the whole point is that a phone with the app closed still hears about
  // a direct message, and somebody has a laptop as well as a phone.
  //
  // `endpoint` is the natural key for BOTH transports — a Web Push endpoint URL
  // and an Expo/FCM token are each already a globally unique device address —
  // which is what makes re-subscribing idempotent. A browser hands back the same
  // endpoint every time until permission is revoked, so a user who opens the app
  // fifty times has one row, not fifty.
  await sql`
    CREATE TABLE IF NOT EXISTS public.push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('web', 'expo')),
      endpoint text NOT NULL UNIQUE,
      -- Web Push only: the browser's per-subscription encryption keys. Null for
      -- Expo, which addresses the device by token and does its own transport
      -- security.
      p256dh text,
      auth text,
      -- For telling a member which of their devices this is, and for pruning.
      label text,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
      ON public.push_subscriptions (user_id)
  `;
  // Passwordless email sign-in — one row per issued code, holding only HASHES of
  // the 6-digit code and the magic-link token. Mirror of
  // cloud/migrations/012_email_login_codes.sql.
  await sql`
    CREATE TABLE IF NOT EXISTS public.email_login_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      code_hash text NOT NULL,
      link_hash text NOT NULL UNIQUE,
      redirect_uri text,
      attempts int NOT NULL DEFAULT 0,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_email_login_codes_live
      ON public.email_login_codes (email, created_at DESC) WHERE consumed_at IS NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_email_login_codes_created
      ON public.email_login_codes (created_at)
  `;
  // Hash of the __Host- cookie naming the browser that asked. Added separately
  // because the table predates it — see cloud/migrations/013_email_login_origin.sql.
  await sql`
    ALTER TABLE public.email_login_codes
      ADD COLUMN IF NOT EXISTS origin_hash text
  `;
  // lmthing.social — a society for AI agents (after 1f916). Self-registered
  // agents cooperate in open groups, contribute to a shared per-group log, and
  // vote on each other (karma). Mirror of cloud/migrations/014_social_groups.sql.
  await sql`
    CREATE TABLE IF NOT EXISTS public.social_agents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      handle text NOT NULL,
      secret_hash text NOT NULL UNIQUE,
      model text,
      bio text,
      karma integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_social_agents_handle
      ON public.social_agents (lower(handle))
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_agents_karma
      ON public.social_agents (karma DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.social_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      goal text NOT NULL,
      created_by uuid NOT NULL REFERENCES public.social_agents(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_groups_status
      ON public.social_groups (status, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_groups_creator
      ON public.social_groups (created_by, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.social_group_members (
      group_id uuid NOT NULL REFERENCES public.social_groups(id) ON DELETE CASCADE,
      agent_id uuid NOT NULL REFERENCES public.social_agents(id) ON DELETE CASCADE,
      handle text NOT NULL,
      role text NOT NULL CHECK (role IN ('founder', 'contributor')),
      joined_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, agent_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_group_members_agent
      ON public.social_group_members (agent_id)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.social_group_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES public.social_groups(id) ON DELETE CASCADE,
      agent_id uuid NOT NULL REFERENCES public.social_agents(id) ON DELETE CASCADE,
      handle text NOT NULL,
      kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'contribution', 'result')),
      body text NOT NULL,
      score integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_group_messages_group
      ON public.social_group_messages (group_id, created_at ASC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_group_messages_agent
      ON public.social_group_messages (agent_id, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.social_message_votes (
      message_id uuid NOT NULL REFERENCES public.social_group_messages(id) ON DELETE CASCADE,
      agent_id uuid NOT NULL REFERENCES public.social_agents(id) ON DELETE CASCADE,
      value smallint NOT NULL CHECK (value IN (-1, 1)),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, agent_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_social_message_votes_agent
      ON public.social_message_votes (agent_id, created_at DESC)
  `;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  kind: "web" | "expo";
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Register a device, or refresh the one already at this endpoint.
 *
 * Keyed on the endpoint rather than (user, device): a browser reports the same
 * endpoint until permission is revoked, so this is naturally idempotent. It also
 * re-points a device at whoever is signed in on it now, which is the correct
 * reading of "this endpoint belongs to that user" when a shared machine changes
 * hands.
 */
export async function savePushSubscription(sub: {
  userId: string;
  kind: "web" | "expo";
  endpoint: string;
  p256dh?: string | null;
  auth?: string | null;
  label?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO push_subscriptions (user_id, kind, endpoint, p256dh, auth, label)
    VALUES (${sub.userId}, ${sub.kind}, ${sub.endpoint},
            ${sub.p256dh ?? null}, ${sub.auth ?? null}, ${sub.label ?? null})
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = ${sub.userId},
          kind = ${sub.kind},
          p256dh = ${sub.p256dh ?? null},
          auth = ${sub.auth ?? null},
          label = ${sub.label ?? null}
  `;
}

export async function listPushSubscriptions(
  userIds: readonly string[],
): Promise<PushSubscription[]> {
  if (!userIds.length) return [];
  return sql<PushSubscription[]>`
    SELECT * FROM push_subscriptions WHERE user_id = ANY(${userIds as string[]})
  `;
}

/**
 * Drop a device.
 *
 * Called on explicit unsubscribe AND whenever a transport reports the endpoint
 * is gone (a 404/410 from Web Push, a DeviceNotRegistered from Expo). Keeping a
 * dead endpoint means every future notification pays for a request that cannot
 * succeed.
 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export async function touchPushSubscriptions(
  endpoints: readonly string[],
): Promise<void> {
  if (!endpoints.length) return;
  await sql`
    UPDATE push_subscriptions SET last_used_at = now()
    WHERE endpoint = ANY(${endpoints as string[]})
  `;
}

export interface BackupConfig {
  user_id: string;
  installation_id: string | null;
  repo: string | null;
  auto: boolean;
  interval_minutes: number;
  branch: string;
  last_backup_at: string | null;
  last_commit_sha: string | null;
  status: string | null;
  error: string | null;
  updated_at: string;
}

export async function getBackupConfig(
  userId: string,
): Promise<BackupConfig | null> {
  const rows = await sql<BackupConfig[]>`
    SELECT * FROM backup_config WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Record (or update) which GitHub App installation backs this user. */
export async function setBackupInstallation(
  userId: string,
  installationId: string,
): Promise<void> {
  await sql`
    INSERT INTO backup_config (user_id, installation_id, updated_at)
    VALUES (${userId}, ${installationId}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET installation_id = ${installationId}, updated_at = now()
  `;
}

/** Persist the user-chosen backup settings (repo + auto + interval). */
export async function setBackupSettings(
  userId: string,
  repo: string,
  auto: boolean,
  intervalMinutes: number,
): Promise<void> {
  await sql`
    INSERT INTO backup_config (user_id, repo, auto, interval_minutes, updated_at)
    VALUES (${userId}, ${repo}, ${auto}, ${intervalMinutes}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET repo = ${repo}, auto = ${auto},
          interval_minutes = ${intervalMinutes}, updated_at = now()
  `;
}

export interface SsoCode {
  id: string;
  user_id: string;
  code: string;
  redirect_uri: string;
  app: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export async function insertSsoCode(
  userId: string,
  code: string,
  redirectUri: string,
  app: string,
  expiresAt: Date,
): Promise<void> {
  await sql`
    INSERT INTO sso_codes (user_id, code, redirect_uri, app, expires_at)
    VALUES (${userId}, ${code}, ${redirectUri}, ${app}, ${expiresAt.toISOString()})
  `;
}

export async function findAndConsumeSsoCode(
  code: string,
  redirectUri: string,
): Promise<SsoCode | null> {
  const rows = await sql<SsoCode[]>`
    SELECT * FROM sso_codes
    WHERE code = ${code}
      AND used_at IS NULL
    LIMIT 1
  `;

  const ssoCode = rows[0];
  if (!ssoCode) return null;

  if (new Date(ssoCode.expires_at) < new Date()) return null;
  if (ssoCode.redirect_uri !== redirectUri) return null;

  await sql`
    UPDATE sso_codes SET used_at = NOW() WHERE id = ${ssoCode.id}
  `;

  return ssoCode;
}

// ─── Externalized cron (user_cron_jobs) ───────────────────────────────────────

/** One cron job as published by a pod's manifest. `nextRunAt` is epoch-ms. */
export interface CronManifestJob {
  projectId: string;
  slug: string;
  cronExpr: string;
  everyMs: number;
  nextRunAt: number;
}

/** A due cron job row the wake tick acts on. */
export interface DueCronJob {
  user_id: string;
  project_id: string;
  slug: string;
  next_run_at: string;
}

/**
 * Replace a user's ENTIRE cron manifest atomically: upsert every job in `jobs`
 * and delete any of that user's rows no longer present (a hook was removed /
 * app uninstalled). `last_woken_at` is preserved for surviving rows.
 */
export async function replaceCronManifest(
  userId: string,
  jobs: CronManifestJob[],
  floorMs: number,
): Promise<void> {
  await sql.begin(async (tx) => {
    for (const j of jobs) {
      await tx`
        INSERT INTO user_cron_jobs
          (user_id, project_id, slug, cron_expr, every_ms, next_run_at, updated_at)
        VALUES (
          ${userId}, ${j.projectId}, ${j.slug}, ${j.cronExpr}, ${j.everyMs},
          to_timestamp(${j.nextRunAt}::float8 / 1000.0), now()
        )
        ON CONFLICT (user_id, project_id, slug) DO UPDATE
          SET cron_expr = EXCLUDED.cron_expr,
              every_ms = EXCLUDED.every_ms,
              -- Enforce the tier floor: never re-fire sooner than floorMs after the
              -- last wake (throttles a clamped every:'5m' free hook to the 60-min
              -- floor) while still honouring a later wall-clock next_run_at (daily).
              next_run_at = GREATEST(
                EXCLUDED.next_run_at,
                COALESCE(user_cron_jobs.last_woken_at, to_timestamp(0))
                  + make_interval(secs => ${floorMs}::float8 / 1000.0)
              ),
              updated_at = now()
      `;
    }
    // Delete this user's rows not present in the new manifest.
    const keep = jobs.map((j) => `${j.projectId}/${j.slug}`);
    if (keep.length === 0) {
      await tx`DELETE FROM user_cron_jobs WHERE user_id = ${userId}`;
    } else {
      await tx`
        DELETE FROM user_cron_jobs
        WHERE user_id = ${userId}
          AND (project_id || '/' || slug) <> ALL(${keep})
      `;
    }
  });
}

/**
 * Select cron jobs due to fire (`next_run_at <= now()`), skipping any woken
 * within `cooldownMs` (so a still-booting pod isn't re-woken every tick). Ordered
 * most-overdue first, capped at `limit`. `FOR UPDATE SKIP LOCKED` is
 * belt-and-suspenders behind the leader lock.
 */
export async function selectDueCronJobs(
  limit: number,
  cooldownMs: number,
): Promise<DueCronJob[]> {
  return await sql<DueCronJob[]>`
    SELECT user_id, project_id, slug, next_run_at
    FROM user_cron_jobs
    WHERE next_run_at <= now()
      AND (
        last_woken_at IS NULL
        OR last_woken_at < now() - make_interval(secs => ${cooldownMs}::float8 / 1000.0)
      )
    ORDER BY next_run_at ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;
}

/** Stamp `last_woken_at=now()` on all of a user's currently-due jobs (cooldown). */
export async function markCronWoken(userId: string): Promise<void> {
  await sql`
    UPDATE user_cron_jobs
    SET last_woken_at = now()
    WHERE user_id = ${userId} AND next_run_at <= now()
  `;
}

/** Drop all cron rows for a user (e.g. on pod deletion). */
export async function deleteCronJobs(userId: string): Promise<void> {
  await sql`DELETE FROM user_cron_jobs WHERE user_id = ${userId}`;
}

// ─── Inbound webhook bindings (webhook_bindings) ──────────────────────────────

/** One inbound webhook binding as published by a pod's manifest. */
export interface WebhookBinding {
  path: string;
  provider: string | null;
  agentRef: string | null;
  projectId: string | null;
}

/** A stored binding row, as returned to the UI (GET /api/inbound). */
export interface WebhookBindingRow {
  user_id: string;
  path: string;
  provider: string | null;
  agent_ref: string | null;
  project_id: string | null;
  updated_at: string;
}

/**
 * Replace a user's ENTIRE webhook-binding set atomically: upsert every binding
 * in `bindings` and delete any of that user's rows no longer present (a hook
 * was removed / app uninstalled). Mirrors {@link replaceCronManifest}.
 */
export async function upsertWebhookBindings(
  userId: string,
  bindings: WebhookBinding[],
): Promise<void> {
  await sql.begin(async (tx) => {
    for (const b of bindings) {
      await tx`
        INSERT INTO webhook_bindings
          (user_id, path, provider, agent_ref, project_id, updated_at)
        VALUES (
          ${userId}, ${b.path}, ${b.provider}, ${b.agentRef}, ${b.projectId}, now()
        )
        ON CONFLICT (user_id, path) DO UPDATE
          SET provider = EXCLUDED.provider,
              agent_ref = EXCLUDED.agent_ref,
              project_id = EXCLUDED.project_id,
              updated_at = now()
      `;
    }
    const keep = bindings.map((b) => b.path);
    if (keep.length === 0) {
      await tx`DELETE FROM webhook_bindings WHERE user_id = ${userId}`;
    } else {
      await tx`
        DELETE FROM webhook_bindings
        WHERE user_id = ${userId}
          AND path <> ALL(${keep})
      `;
    }
  });
}

/** List a user's currently-registered inbound webhook bindings. */
export async function listWebhookBindings(
  userId: string,
): Promise<WebhookBindingRow[]> {
  return await sql<WebhookBindingRow[]>`
    SELECT * FROM webhook_bindings WHERE user_id = ${userId}
  `;
}

// ─── Teams (teams, team_members, team_invites) ────────────────────────────────

export type TeamRole = "viewer" | "editor";

export interface Team {
  id: string;
  name: string;
  created_by: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  email: string;
  role: TeamRole;
  invited_by: string | null;
  created_at: string;
}

/** A team as seen by one member — the row plus that member's own role. */
export interface TeamWithRole extends Team {
  role: TeamRole;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/** An invite joined to its team's name, for the "pending invites" list. */
export interface TeamInviteWithTeam extends TeamInvite {
  team_name: string;
}

/**
 * Create a team and seat its creator as the first editor, in one transaction —
 * a team with no editor could never be configured again.
 */
export async function createTeam(
  name: string,
  createdBy: string,
  creatorEmail: string,
  stripeCustomerId: string | null,
): Promise<Team> {
  return await sql.begin(async (tx) => {
    const [team] = await tx<Team[]>`
      INSERT INTO teams (name, created_by, stripe_customer_id)
      VALUES (${name}, ${createdBy}, ${stripeCustomerId})
      RETURNING *
    `;
    await tx`
      INSERT INTO team_members (team_id, user_id, email, role)
      VALUES (${team!.id}, ${createdBy}, ${creatorEmail}, 'editor')
    `;
    return team!;
  });
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const rows = await sql<Team[]>`
    SELECT * FROM teams WHERE id = ${teamId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function setTeamName(teamId: string, name: string): Promise<void> {
  await sql`
    UPDATE teams SET name = ${name}, updated_at = now() WHERE id = ${teamId}
  `;
}

export async function setTeamStripeCustomer(
  teamId: string,
  customerId: string,
): Promise<void> {
  await sql`
    UPDATE teams SET stripe_customer_id = ${customerId}, updated_at = now()
    WHERE id = ${teamId}
  `;
}

export async function deleteTeam(teamId: string): Promise<void> {
  // team_members / team_invites cascade.
  await sql`DELETE FROM teams WHERE id = ${teamId}`;
}

/** Every team this user belongs to, with their own role in each. */
export async function listTeamsForUser(userId: string): Promise<TeamWithRole[]> {
  return await sql<TeamWithRole[]>`
    SELECT t.*, m.role
    FROM teams t
    JOIN team_members m ON m.team_id = t.id
    WHERE m.user_id = ${userId}
    ORDER BY t.created_at ASC
  `;
}

/** This user's membership row, or null if they are not on the team. */
export async function getTeamMembership(
  teamId: string,
  userId: string,
): Promise<TeamMember | null> {
  const rows = await sql<TeamMember[]>`
    SELECT * FROM team_members
    WHERE team_id = ${teamId} AND user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  return await sql<TeamMember[]>`
    SELECT * FROM team_members WHERE team_id = ${teamId}
    ORDER BY created_at ASC
  `;
}

/** Add (or re-add) a member. Idempotent on (team, user): updates the role. */
export async function upsertTeamMember(
  teamId: string,
  userId: string,
  email: string,
  role: TeamRole,
  invitedBy: string | null,
): Promise<void> {
  await sql`
    INSERT INTO team_members (team_id, user_id, email, role, invited_by)
    VALUES (${teamId}, ${userId}, ${email}, ${role}, ${invitedBy})
    ON CONFLICT (team_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, email = EXCLUDED.email
  `;
}

/**
 * Change a member's role, refusing to demote the team's last editor — a team
 * with only viewers can never be configured or billed again. Returns false when
 * the change was refused for that reason.
 */
export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<boolean> {
  return await sql.begin(async (tx) => {
    // Select the ROWS and count them here. `count(*) … FOR UPDATE` is rejected
    // by Postgres ("FOR UPDATE is not allowed with aggregate functions"), and a
    // guard that always throws is a guard that never guards.
    const others = await tx<{ user_id: string }[]>`
      SELECT user_id FROM team_members
      WHERE team_id = ${teamId} AND role = 'editor' AND user_id <> ${userId}
      FOR UPDATE
    `;
    if (role === "viewer" && others.length === 0) return false;
    await tx`
      UPDATE team_members SET role = ${role}
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
    return true;
  });
}

/** Remove a member, refusing to remove the team's last editor (see above). */
export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<boolean> {
  return await sql.begin(async (tx) => {
    // Rows, not count(*) — see updateTeamMemberRole.
    const others = await tx<{ user_id: string }[]>`
      SELECT user_id FROM team_members
      WHERE team_id = ${teamId} AND role = 'editor' AND user_id <> ${userId}
      FOR UPDATE
    `;
    const [target] = await tx<TeamMember[]>`
      SELECT * FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!target) return false;
    if (target.role === "editor" && others.length === 0) return false;
    await tx`
      DELETE FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
    return true;
  });
}

/** How many editors a team has (used to guard the last-editor rule in routes). */
export async function countTeamEditors(teamId: string): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    SELECT count(*) AS count FROM team_members
    WHERE team_id = ${teamId} AND role = 'editor'
  `;
  return Number(row?.count ?? 0);
}

/** Create (or refresh) a pending invite for an email that has no account yet. */
export async function upsertTeamInvite(
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy: string,
): Promise<TeamInvite> {
  const [invite] = await sql<TeamInvite[]>`
    INSERT INTO team_invites (team_id, email, role, invited_by)
    VALUES (${teamId}, ${email.toLowerCase()}, ${role}, ${invitedBy})
    ON CONFLICT (team_id, email) WHERE accepted_at IS NULL DO UPDATE
      SET role = EXCLUDED.role,
          invited_by = EXCLUDED.invited_by,
          expires_at = now() + interval '14 days'
    RETURNING *
  `;
  return invite!;
}

export async function getTeamInvite(
  inviteId: string,
): Promise<TeamInvite | null> {
  const rows = await sql<TeamInvite[]>`
    SELECT * FROM team_invites WHERE id = ${inviteId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Pending, unexpired invites addressed to this email. */
export async function listPendingInvitesForEmail(
  email: string,
): Promise<TeamInviteWithTeam[]> {
  return await sql<TeamInviteWithTeam[]>`
    SELECT i.*, t.name AS team_name
    FROM team_invites i
    JOIN teams t ON t.id = i.team_id
    WHERE i.email = ${email.toLowerCase()}
      AND i.accepted_at IS NULL
      AND i.expires_at > now()
    ORDER BY i.created_at ASC
  `;
}

export async function listTeamInvites(
  teamId: string,
): Promise<TeamInvite[]> {
  return await sql<TeamInvite[]>`
    SELECT * FROM team_invites
    WHERE team_id = ${teamId} AND accepted_at IS NULL AND expires_at > now()
    ORDER BY created_at ASC
  `;
}

/**
 * Accept an invite: seat the member and stamp the invite, atomically, so a
 * double-click can't produce a half-applied accept. Re-checks expiry and
 * addressee inside the transaction. Returns false if the invite is no longer
 * claimable by this email.
 */
export async function acceptTeamInvite(
  inviteId: string,
  userId: string,
  email: string,
): Promise<boolean> {
  return await sql.begin(async (tx) => {
    const [invite] = await tx<TeamInvite[]>`
      SELECT * FROM team_invites
      WHERE id = ${inviteId}
        AND accepted_at IS NULL
        AND expires_at > now()
        AND email = ${email.toLowerCase()}
      FOR UPDATE
    `;
    if (!invite) return false;
    await tx`
      INSERT INTO team_members (team_id, user_id, email, role, invited_by)
      VALUES (${invite.team_id}, ${userId}, ${email}, ${invite.role}, ${invite.invited_by})
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
    await tx`
      UPDATE team_invites SET accepted_at = now() WHERE id = ${inviteId}
    `;
    return true;
  });
}

export async function revokeTeamInvite(inviteId: string): Promise<void> {
  await sql`DELETE FROM team_invites WHERE id = ${inviteId}`;
}

/** Find the team that owns a Stripe customer (subscription webhook lookup). */
export async function getTeamByStripeCustomer(
  customerId: string,
): Promise<Team | null> {
  const rows = await sql<Team[]>`
    SELECT * FROM teams WHERE stripe_customer_id = ${customerId} LIMIT 1
  `;
  return rows[0] ?? null;
}

// ─── Passwordless email sign-in (email_login_codes) ──────────────────────────
//
// One row per issued sign-in code. It stores only the SHA-256 of the 6-digit
// code (bound to the mailbox) and of the magic-link token, so a database dump
// contains no usable credential. The row is the single-use unit: consuming it
// through either credential invalidates the other.
//
// Every read is bounded by `consumed_at IS NULL AND expires_at > now()` in SQL
// rather than in the handler, so an expired or already-spent row is invisible to
// the verification paths by construction.

export interface EmailLoginCode {
  id: string;
  email: string;
  code_hash: string;
  link_hash: string;
  redirect_uri: string | null;
  /** sha256 of the origin cookie, or null when the request had no browser behind it. */
  origin_hash: string | null;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

/**
 * Store a freshly issued code, superseding any live code for the same mailbox.
 *
 * Superseding is what makes "resend" behave the way a user expects: after asking
 * again, only the newest code works. Without it the older code stays valid for
 * its full TTL and the two are indistinguishable in the inbox.
 */
export async function insertEmailLoginCode(input: {
  email: string;
  codeHash: string;
  linkHash: string;
  redirectUri: string | null;
  originHash: string | null;
  expiresAt: Date;
}): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE email_login_codes SET consumed_at = now()
      WHERE email = ${input.email} AND consumed_at IS NULL
    `;
    await tx`
      INSERT INTO email_login_codes (email, code_hash, link_hash, redirect_uri, origin_hash, expires_at)
      VALUES (${input.email}, ${input.codeHash}, ${input.linkHash},
              ${input.redirectUri}, ${input.originHash}, ${input.expiresAt.toISOString()})
    `;
  });
}

/** Sends to this mailbox since `since` — the per-mailbox send throttle. */
export async function countRecentEmailLoginCodes(
  email: string,
  since: Date,
): Promise<number> {
  const rows = await sql<{ n: string }[]>`
    SELECT count(*) AS n FROM email_login_codes
    WHERE email = ${email} AND created_at > ${since.toISOString()}
  `;
  return Number(rows[0]?.n ?? 0);
}

/** The live code row for a mailbox, newest first. */
export async function findLiveEmailLoginCode(
  email: string,
): Promise<EmailLoginCode | null> {
  const rows = await sql<EmailLoginCode[]>`
    SELECT * FROM email_login_codes
    WHERE email = ${email} AND consumed_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** The live row a magic-link token addresses. */
export async function findLiveEmailLoginCodeByLink(
  linkHash: string,
): Promise<EmailLoginCode | null> {
  const rows = await sql<EmailLoginCode[]>`
    SELECT * FROM email_login_codes
    WHERE link_hash = ${linkHash} AND consumed_at IS NULL AND expires_at > now()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Spend the row. Returns false when someone else already did.
 *
 * The `consumed_at IS NULL` predicate lives in the UPDATE, so single-use is
 * enforced by the row lock rather than by a read-then-write in the handler —
 * two simultaneous submissions of the same code cannot both win.
 */
export async function consumeEmailLoginCode(id: string): Promise<boolean> {
  const rows = await sql`
    UPDATE email_login_codes SET consumed_at = now()
    WHERE id = ${id} AND consumed_at IS NULL AND expires_at > now()
    RETURNING 1 AS consumed
  `;
  return rows.length > 0;
}

/**
 * Count a wrong guess, burning the row once the cap is reached. Returns the new
 * attempt count so the caller can tell "wrong, try again" from "start over".
 */
export async function recordEmailLoginAttempt(
  id: string,
  maxAttempts: number,
): Promise<number> {
  const rows = await sql<{ attempts: number }[]>`
    UPDATE email_login_codes
    SET attempts = attempts + 1,
        consumed_at = CASE WHEN attempts + 1 >= ${maxAttempts} THEN now() ELSE consumed_at END
    WHERE id = ${id}
    RETURNING attempts
  `;
  return rows[0]?.attempts ?? maxAttempts;
}

/** Drop rows that can no longer be used by anyone. Called opportunistically. */
export async function purgeExpiredEmailLoginCodes(): Promise<void> {
  await sql`
    DELETE FROM email_login_codes
    WHERE created_at < now() - interval '1 day'
  `;
}

// ═══════════════════════════════════════════════════════════════
// SOCIAL — a society for AI agents (lmthing.social, after 1f916)
// ═══════════════════════════════════════════════════════════════
//
// Self-registered agents (social_agents) cooperate in open groups, each pinned
// to one goal, by posting to a shared per-group log; they vote on one another's
// messages and the votes accrue as karma on the author. Reading is public;
// writing needs the agent's secret. Schema in cloud/migrations/014_social_groups.sql,
// mirrored in ensureSchema().

export type SocialGroupStatus = "open" | "closed";
export type SocialGroupRole = "founder" | "contributor";
export type SocialMessageKind = "message" | "contribution" | "result";

export interface SocialAgent {
  id: string;
  handle: string;
  secret_hash: string;
  model: string | null;
  bio: string | null;
  karma: number;
  created_at: string;
  last_seen_at: string | null;
}

/** An agent as shown publicly — never the secret hash. */
export interface SocialAgentPublic {
  id: string;
  handle: string;
  model: string | null;
  bio: string | null;
  karma: number;
  created_at: string;
  last_seen_at: string | null;
}

export interface SocialGroup {
  id: string;
  title: string;
  goal: string;
  created_by: string;
  status: SocialGroupStatus;
  created_at: string;
  updated_at: string;
}

/** A group row plus the counts the feed shows, and the caller's own role if any. */
export interface SocialGroupSummary extends SocialGroup {
  member_count: number;
  message_count: number;
  role: SocialGroupRole | null;
}

export interface SocialGroupMember {
  group_id: string;
  agent_id: string;
  handle: string;
  role: SocialGroupRole;
  joined_at: string;
}

export interface SocialGroupMessage {
  id: string;
  group_id: string;
  agent_id: string;
  handle: string;
  kind: SocialMessageKind;
  body: string;
  score: number;
  created_at: string;
}

/** The three counts that both the quota gate and the human view read. */
export interface SocialQuotaUsage {
  groups: number;
  messages: number;
  votes: number;
}

/** Society-wide totals for the constitution endpoint and the human landing. */
export interface SocialStats {
  agents: number;
  groups: number;
  open_groups: number;
  messages: number;
  votes: number;
}

// ── Citizens ──────────────────────────────────────────────────────────────────

/**
 * Register a new agent. The secret is minted and hashed by the caller; only the
 * hash is stored. Throws on a duplicate handle (unique index) — the route turns
 * that into a 409.
 */
export async function createSocialAgent(
  handle: string,
  secretHash: string,
  model: string | null,
  bio: string | null,
): Promise<SocialAgentPublic> {
  const [row] = await sql<SocialAgentPublic[]>`
    INSERT INTO social_agents (handle, secret_hash, model, bio)
    VALUES (${handle}, ${secretHash}, ${model}, ${bio})
    RETURNING id, handle, model, bio, karma, created_at, last_seen_at
  `;
  return row!;
}

/** Resolve an agent by the SHA-256 of its presented secret. The auth lookup. */
export async function getSocialAgentBySecretHash(
  secretHash: string,
): Promise<SocialAgent | null> {
  const rows = await sql<SocialAgent[]>`
    SELECT * FROM social_agents WHERE secret_hash = ${secretHash} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getSocialAgentByHandle(
  handle: string,
): Promise<SocialAgentPublic | null> {
  const rows = await sql<SocialAgentPublic[]>`
    SELECT id, handle, model, bio, karma, created_at, last_seen_at
    FROM social_agents
    WHERE lower(handle) = lower(${handle}) LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Bump last_seen_at. Best-effort — callers fire and forget. */
export async function touchSocialAgent(agentId: string): Promise<void> {
  await sql`UPDATE social_agents SET last_seen_at = now() WHERE id = ${agentId}`;
}

/** The karma leaderboard, highest first. */
export async function listSocialAgents(
  limit: number,
): Promise<SocialAgentPublic[]> {
  const cap = Math.min(Math.max(Math.trunc(limit) || 25, 1), 100);
  return await sql<SocialAgentPublic[]>`
    SELECT id, handle, model, bio, karma, created_at, last_seen_at
    FROM social_agents
    ORDER BY karma DESC, created_at ASC
    LIMIT ${cap}
  `;
}

// ── Groups ────────────────────────────────────────────────────────────────────

/**
 * Create a group and seat its creator as the founder, in one transaction — a
 * group with no founder could never be closed.
 */
export async function createSocialGroup(
  title: string,
  goal: string,
  createdBy: string,
  founderHandle: string,
): Promise<SocialGroup> {
  return await sql.begin(async (tx) => {
    const [group] = await tx<SocialGroup[]>`
      INSERT INTO social_groups (title, goal, created_by)
      VALUES (${title}, ${goal}, ${createdBy})
      RETURNING *
    `;
    await tx`
      INSERT INTO social_group_members (group_id, agent_id, handle, role)
      VALUES (${group!.id}, ${createdBy}, ${founderHandle}, 'founder')
    `;
    return group!;
  });
}

export async function getSocialGroup(groupId: string): Promise<SocialGroup | null> {
  const rows = await sql<SocialGroup[]>`
    SELECT * FROM social_groups WHERE id = ${groupId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * The feed. `status` filters to open/closed groups, or all of them. When a
 * `callerId` is given (an authenticated agent), that agent's own role in each
 * group is joined in; for the public human view it is null. Newest first,
 * capped at `limit` (1..100).
 */
export async function listSocialGroups(
  callerId: string | null,
  status: SocialGroupStatus | "all",
  limit: number,
): Promise<SocialGroupSummary[]> {
  const cap = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  return await sql<SocialGroupSummary[]>`
    SELECT
      g.*,
      (SELECT count(*)::int FROM social_group_members m WHERE m.group_id = g.id) AS member_count,
      (SELECT count(*)::int FROM social_group_messages x WHERE x.group_id = g.id) AS message_count,
      mine.role
    FROM social_groups g
    LEFT JOIN social_group_members mine
      ON mine.group_id = g.id AND mine.agent_id = ${callerId}
    ${status === "all" ? sql`` : sql`WHERE g.status = ${status}`}
    ORDER BY g.created_at DESC
    LIMIT ${cap}
  `;
}

/** This agent's membership row in a group, or null. */
export async function getSocialGroupMembership(
  groupId: string,
  agentId: string,
): Promise<SocialGroupMember | null> {
  const rows = await sql<SocialGroupMember[]>`
    SELECT * FROM social_group_members
    WHERE group_id = ${groupId} AND agent_id = ${agentId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listSocialGroupMembers(
  groupId: string,
): Promise<SocialGroupMember[]> {
  return await sql<SocialGroupMember[]>`
    SELECT * FROM social_group_members WHERE group_id = ${groupId}
    ORDER BY joined_at ASC
  `;
}

/** Groups an agent belongs to, with that agent's role — for its public profile. */
export async function listSocialAgentMemberships(
  agentId: string,
): Promise<(SocialGroup & { role: SocialGroupRole })[]> {
  return await sql<(SocialGroup & { role: SocialGroupRole })[]>`
    SELECT g.*, m.role
    FROM social_group_members m
    JOIN social_groups g ON g.id = m.group_id
    WHERE m.agent_id = ${agentId}
    ORDER BY m.joined_at DESC
  `;
}

/**
 * Join an open group as a contributor. Idempotent on (group, agent): a repeat
 * join keeps the existing row (and role) rather than demoting a founder. Returns
 * the caller's membership row.
 */
export async function joinSocialGroup(
  groupId: string,
  agentId: string,
  handle: string,
): Promise<SocialGroupMember> {
  const [row] = await sql<SocialGroupMember[]>`
    INSERT INTO social_group_members (group_id, agent_id, handle, role)
    VALUES (${groupId}, ${agentId}, ${handle}, 'contributor')
    ON CONFLICT (group_id, agent_id) DO UPDATE SET handle = EXCLUDED.handle
    RETURNING *
  `;
  return row!;
}

/**
 * Leave a group. Refuses to remove the founder (returns false) — the founder
 * closes the group instead, so a group is never left owner-less. Returns whether
 * a row was removed.
 */
export async function leaveSocialGroup(
  groupId: string,
  agentId: string,
): Promise<boolean> {
  const rows = await sql<{ role: SocialGroupRole }[]>`
    DELETE FROM social_group_members
    WHERE group_id = ${groupId} AND agent_id = ${agentId} AND role <> 'founder'
    RETURNING role
  `;
  return rows.length > 0;
}

/** Mark a group closed. Returns the updated row, or null if it was gone. */
export async function closeSocialGroup(
  groupId: string,
): Promise<SocialGroup | null> {
  const rows = await sql<SocialGroup[]>`
    UPDATE social_groups SET status = 'closed', updated_at = now()
    WHERE id = ${groupId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

// ── The shared log ──────────────────────────────────────────────────────────

/** Append to a group's shared log. Returns the stored message. */
export async function addSocialGroupMessage(
  groupId: string,
  agentId: string,
  handle: string,
  kind: SocialMessageKind,
  body: string,
): Promise<SocialGroupMessage> {
  const [row] = await sql<SocialGroupMessage[]>`
    INSERT INTO social_group_messages (group_id, agent_id, handle, kind, body)
    VALUES (${groupId}, ${agentId}, ${handle}, ${kind}, ${body})
    RETURNING *
  `;
  return row!;
}

export async function getSocialMessage(
  messageId: string,
): Promise<SocialGroupMessage | null> {
  const rows = await sql<SocialGroupMessage[]>`
    SELECT * FROM social_group_messages WHERE id = ${messageId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * The shared log, oldest first. `after` is an ISO timestamp cursor for polling —
 * pass the `created_at` of the last message you saw to get only newer ones.
 */
export async function listSocialGroupMessages(
  groupId: string,
  limit: number,
  after?: string,
): Promise<SocialGroupMessage[]> {
  const cap = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  return await sql<SocialGroupMessage[]>`
    SELECT * FROM social_group_messages
    WHERE group_id = ${groupId}
    ${after ? sql`AND created_at > ${after}` : sql``}
    ORDER BY created_at ASC
    LIMIT ${cap}
  `;
}

/** Recent messages by one agent, joined to their group title — for its profile. */
export async function listSocialAgentMessages(
  agentId: string,
  limit: number,
): Promise<(SocialGroupMessage & { group_title: string })[]> {
  const cap = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  return await sql<(SocialGroupMessage & { group_title: string })[]>`
    SELECT x.*, g.title AS group_title
    FROM social_group_messages x
    JOIN social_groups g ON g.id = x.group_id
    WHERE x.agent_id = ${agentId}
    ORDER BY x.created_at DESC
    LIMIT ${cap}
  `;
}

// ── Karma (votes) ─────────────────────────────────────────────────────────────

/**
 * Cast (or change, or retract) a vote on a message, and move the author's karma
 * and the message's cached score by the delta — all in one transaction so the
 * two caches never drift from the votes table.
 *
 * `value` is +1 or -1 to vote, or 0 to retract an existing vote. Returns the
 * message's new score. Idempotent: re-casting the same value is a no-op.
 */
export async function voteSocialMessage(
  messageId: string,
  agentId: string,
  authorId: string,
  value: -1 | 0 | 1,
): Promise<number> {
  return await sql.begin(async (tx) => {
    const prevRows = await tx<{ value: number }[]>`
      SELECT value FROM social_message_votes
      WHERE message_id = ${messageId} AND agent_id = ${agentId}
    `;
    const prev = prevRows[0]?.value ?? 0;
    const delta = value - prev;
    if (delta !== 0) {
      if (value === 0) {
        await tx`
          DELETE FROM social_message_votes
          WHERE message_id = ${messageId} AND agent_id = ${agentId}
        `;
      } else {
        await tx`
          INSERT INTO social_message_votes (message_id, agent_id, value)
          VALUES (${messageId}, ${agentId}, ${value})
          ON CONFLICT (message_id, agent_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()
        `;
      }
      await tx`
        UPDATE social_group_messages SET score = score + ${delta} WHERE id = ${messageId}
      `;
      await tx`
        UPDATE social_agents SET karma = karma + ${delta} WHERE id = ${authorId}
      `;
    }
    const [row] = await tx<{ score: number }[]>`
      SELECT score FROM social_group_messages WHERE id = ${messageId}
    `;
    return row?.score ?? 0;
  });
}

// ── Quotas & society stats ────────────────────────────────────────────────────

/**
 * How much of today's allowance an agent has spent. `sinceIso` is the UTC-midnight
 * boundary computed by the caller, so the window is unambiguous regardless of the
 * database's timezone.
 */
export async function getSocialQuotaUsage(
  agentId: string,
  sinceIso: string,
): Promise<SocialQuotaUsage> {
  const [row] = await sql<SocialQuotaUsage[]>`
    SELECT
      (SELECT count(*)::int FROM social_groups
         WHERE created_by = ${agentId} AND created_at >= ${sinceIso}) AS groups,
      (SELECT count(*)::int FROM social_group_messages
         WHERE agent_id = ${agentId} AND created_at >= ${sinceIso}) AS messages,
      (SELECT count(*)::int FROM social_message_votes
         WHERE agent_id = ${agentId} AND created_at >= ${sinceIso}) AS votes
  `;
  return row ?? { groups: 0, messages: 0, votes: 0 };
}

export async function getSocialStats(): Promise<SocialStats> {
  const [row] = await sql<SocialStats[]>`
    SELECT
      (SELECT count(*)::int FROM social_agents) AS agents,
      (SELECT count(*)::int FROM social_groups) AS groups,
      (SELECT count(*)::int FROM social_groups WHERE status = 'open') AS open_groups,
      (SELECT count(*)::int FROM social_group_messages) AS messages,
      (SELECT count(*)::int FROM social_message_votes) AS votes
  `;
  return row ?? { agents: 0, groups: 0, open_groups: 0, messages: 0, votes: 0 };
}
