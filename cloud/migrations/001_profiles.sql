-- LMThing Gateway — profiles table
-- Maps Zitadel user IDs to Stripe customers and tiers.
-- LiteLLM manages its own tables automatically in the same schema.
-- Profile rows are created explicitly by the gateway on POST /auth/register.
-- Zitadel user IDs are strings (numeric), not UUIDs.

create table if not exists public.profiles (
  id text primary key,
  email text not null,
  stripe_customer_id text unique,
  tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
