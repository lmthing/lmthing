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
  // User-connectable OAuth integrations (Google/Slack/GitHub, generic). Tokens
  // are stored ENCRYPTED (AES-256-GCM, lib/crypto.ts) — never plaintext.
  // Mirror of cloud/migrations/007_connections.sql.
  await sql`
    CREATE TABLE IF NOT EXISTS public.connections (
      user_id text NOT NULL,
      provider text NOT NULL,
      access_token text,
      refresh_token text,
      expires_at timestamptz,
      scopes text,
      status text,
      error text,
      connected_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, provider)
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

// ─── Connections (OAuth integrations) ────────────────────────────────────────

export interface Connection {
  user_id: string;
  provider: string;
  /** Encrypted (iv:tag:ct base64). Decrypt with lib/crypto.ts before use. */
  access_token: string | null;
  /** Encrypted (iv:tag:ct base64). */
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string | null;
  status: string | null;
  error: string | null;
  connected_at: string;
  updated_at: string;
}

/** Fields an upsert writes. Tokens must already be ENCRYPTED by the caller. */
export interface ConnectionUpsert {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
  scopes: string | null;
  status: string;
  error?: string | null;
}

export async function getConnection(
  userId: string,
  provider: string,
): Promise<Connection | null> {
  const rows = await sql<Connection[]>`
    SELECT * FROM connections
    WHERE user_id = ${userId} AND provider = ${provider}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listConnections(userId: string): Promise<Connection[]> {
  return await sql<Connection[]>`
    SELECT * FROM connections WHERE user_id = ${userId}
  `;
}

/** Insert or update a user's connection (tokens must already be encrypted). */
export async function upsertConnection(
  userId: string,
  provider: string,
  data: ConnectionUpsert,
): Promise<void> {
  await sql`
    INSERT INTO connections
      (user_id, provider, access_token, refresh_token, expires_at, scopes,
       status, error, connected_at, updated_at)
    VALUES (
      ${userId}, ${provider}, ${data.access_token}, ${data.refresh_token},
      ${data.expires_at ? data.expires_at.toISOString() : null}, ${data.scopes},
      ${data.status}, ${data.error ?? null}, now(), now()
    )
    ON CONFLICT (user_id, provider) DO UPDATE
      SET access_token = ${data.access_token},
          refresh_token = ${data.refresh_token},
          expires_at = ${data.expires_at ? data.expires_at.toISOString() : null},
          scopes = ${data.scopes},
          status = ${data.status},
          error = ${data.error ?? null},
          updated_at = now()
  `;
}

export async function deleteConnection(
  userId: string,
  provider: string,
): Promise<void> {
  await sql`
    DELETE FROM connections WHERE user_id = ${userId} AND provider = ${provider}
  `;
}

/**
 * Run `fn` with a (user, provider) connection row locked FOR UPDATE inside a
 * transaction. Serializes concurrent proxy calls so a one-time refresh token
 * isn't double-spent (some providers rotate + invalidate on refresh). `fn` gets
 * the locked row (or null) and a transaction-scoped `tx` to persist rotated
 * tokens within the same lock; the whole callback runs in one transaction.
 */
export async function getConnectionForUpdate<T>(
  userId: string,
  provider: string,
  fn: (
    row: Connection | null,
    tx: {
      updateConnection(data: ConnectionUpsert): Promise<void>;
    },
  ) => Promise<T>,
): Promise<T> {
  const result = await sql.begin(async (t) => {
    const rows = await t<Connection[]>`
      SELECT * FROM connections
      WHERE user_id = ${userId} AND provider = ${provider}
      FOR UPDATE
    `;
    const row = rows[0] ?? null;
    const tx = {
      async updateConnection(data: ConnectionUpsert): Promise<void> {
        await t`
          UPDATE connections
          SET access_token = ${data.access_token},
              refresh_token = ${data.refresh_token},
              expires_at = ${data.expires_at ? data.expires_at.toISOString() : null},
              scopes = ${data.scopes},
              status = ${data.status},
              error = ${data.error ?? null},
              updated_at = now()
          WHERE user_id = ${userId} AND provider = ${provider}
        `;
      },
    };
    return await fn(row, tx);
  });
  // `sql.begin` widens the callback return to UnwrapPromiseArray<T>; our fn
  // returns a plain T (never a query array), so this cast is safe.
  return result as T;
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
