-- Remove the OAuth Connections broker: lmthing no longer brokers third-party
-- OAuth or stores provider tokens. Integrations are now bring-your-own-token,
-- configured directly in the pod env (Settings → Integrations). Drop the table
-- that stored encrypted OAuth refresh/access tokens.
DROP TABLE IF EXISTS public.connections;
