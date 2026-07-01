import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 5 });

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
