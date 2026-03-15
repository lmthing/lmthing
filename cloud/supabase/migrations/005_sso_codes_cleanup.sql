-- Automatic cleanup of expired SSO codes.
-- Deletes codes older than 5 minutes (well past the 60s TTL) every minute.

-- Enable pg_cron extension (available on Supabase Pro plan)
create extension if not exists pg_cron;

-- Schedule cleanup every minute
select cron.schedule(
  'cleanup-expired-sso-codes',
  '* * * * *',
  $$delete from public.sso_codes where expires_at < now() - interval '5 minutes'$$
);
