-- User-connectable OAuth integrations (Google / Slack / GitHub, generic).
--
-- One row per (user, provider) OAuth connection. Access/refresh tokens are
-- stored ENCRYPTED at rest (AES-256-GCM, gateway lib/crypto.ts) — never
-- plaintext. The egress proxy reads a row, decrypts the access token, refreshes
-- it under a row lock if expired, and attaches it to the provider request so the
-- token never leaves the gateway. Mirrored idempotently in gateway
-- ensureSchema() (lib/db.ts) — keep the two in sync.

CREATE TABLE IF NOT EXISTS public.connections (
  user_id       text        NOT NULL,
  provider      text        NOT NULL,
  access_token  text,                       -- encrypted (iv:tag:ct base64)
  refresh_token text,                       -- encrypted (iv:tag:ct base64)
  expires_at    timestamptz,                -- access-token expiry, NULL = no expiry
  scopes        text,
  status        text,                       -- 'connected' | 'error'
  error         text,
  connected_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
