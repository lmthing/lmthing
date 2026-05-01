-- SSO authorization codes for cross-domain authentication.
-- Single-use, 60-second TTL codes exchanged for Supabase sessions.

create table if not exists public.sso_codes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  code text not null unique,
  redirect_uri text not null,
  app text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sso_codes_code
  on public.sso_codes (code) where used_at is null;

-- No RLS — only accessed via service role from the gateway
