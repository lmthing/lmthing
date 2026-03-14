-- SSO authorization codes for cross-domain authentication
create table public.sso_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  redirect_uri text not null,
  app text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sso_codes enable row level security;

-- No direct user access — only service role can read/write
-- Edge functions use createServiceClient() which bypasses RLS

create index idx_sso_codes_code on public.sso_codes(code) where used_at is null;
