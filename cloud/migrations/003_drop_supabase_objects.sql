-- Safety migration: drop any Supabase-specific objects that may exist
-- from a partial migration or old deployment. Safe to run on a fresh Postgres.

drop trigger if exists on_auth_user_created on public.profiles;
drop function if exists public.handle_new_user();
