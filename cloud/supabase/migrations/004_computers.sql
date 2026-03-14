-- Computer machines table (one per user, paid tier)
create table if not exists public.computers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,

  -- Fly.io
  fly_machine_id  text unique,
  fly_app_name    text,
  fly_volume_id   text,
  region          text not null default 'iad',
  status          text not null default 'created'
                  check (status in ('created','provisioning','running','stopped','failed','destroyed')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.computers enable row level security;

create policy "Users manage own computer" on public.computers
  for all using (auth.uid() = user_id);

create index idx_computers_user on public.computers(user_id);
