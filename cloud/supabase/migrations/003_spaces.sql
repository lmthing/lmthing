-- Spaces table
create table if not exists public.spaces (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  slug              text not null unique,
  name              text not null,
  description       text,

  -- Fly.io
  fly_machine_id    text unique,
  fly_app_name      text,
  fly_volume_id     text,
  region            text not null default 'iad',
  status            text not null default 'created'
                    check (status in ('created','provisioning','running','stopped','failed','destroyed')),

  -- Config
  app_config        jsonb default '{}',
  auth_enabled      boolean default false,
  custom_domain     text unique,

  -- Per-space DB (schema isolation)
  db_schema         text,

  -- Internal auth
  internal_key_id   uuid references public.api_keys(id),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.spaces enable row level security;

create policy "Users manage own spaces" on public.spaces
  for all using (auth.uid() = user_id);

create policy "Public read running spaces" on public.spaces
  for select using (status = 'running');

create index idx_spaces_user on public.spaces(user_id);
create index idx_spaces_slug on public.spaces(slug);

-- Function to create per-space PostgreSQL schema
create or replace function create_space_schema(schema_name text)
returns void as $$
begin
  execute format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
end;
$$ language plpgsql security definer;
