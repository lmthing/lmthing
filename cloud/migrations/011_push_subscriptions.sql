-- Devices a user has asked to be notified on.
--
-- One row per DEVICE, not per user: the point of push is that a phone with the
-- app closed still hears about a direct message, and people have a laptop as
-- well as a phone.
--
-- `endpoint` is the natural key for both transports — a Web Push endpoint URL
-- and an Expo/FCM device token are each already a globally unique device
-- address. That is what makes re-subscribing idempotent: a browser hands back
-- the same endpoint every time until permission is revoked, so a user who opens
-- the app fifty times has one row rather than fifty.
--
-- Mirrored by `ensureSchema()` in gateway/src/lib/db.ts, which self-heals the
-- schema on boot; this file is the record for a fresh database.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('web', 'expo')),
  endpoint text NOT NULL UNIQUE,
  -- Web Push only: the browser's per-subscription encryption keys. NULL for
  -- Expo, which addresses the device by token and does its own transport
  -- security, so there is nothing for us to encrypt to.
  p256dh text,
  auth text,
  -- For telling a member which of their devices a row is, and for pruning.
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);
