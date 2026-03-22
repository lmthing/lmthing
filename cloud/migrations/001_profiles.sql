-- LMThing Gateway — profiles table
-- Maps Supabase auth users to Stripe customers and tiers.
-- LiteLLM manages its own tables automatically in the same schema.
--
-- NOTE: No FK to auth.users — this avoids breaking LiteLLM's Prisma
-- introspection which cannot handle cross-schema references.

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  stripe_customer_id text unique,
  tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  create policy "Users can read own profile"
    on public.profiles for select
    using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
