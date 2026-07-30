-- Passwordless email sign-in.
--
-- One row per issued sign-in request, carrying TWO credentials for the same
-- single-use row: a 6-digit code the user types back into the page they started
-- from, and an opaque magic-link token they can click from their inbox. Either
-- proves control of the mailbox; consuming either invalidates the other, because
-- `consumed_at` belongs to the row and not to a credential.
--
-- Only hashes are stored. `code_hash` is sha256(email || NUL || code) — bound to
-- the mailbox, because a 6-digit code is brute-forceable and an unbound hash
-- would make a code harvested for one address worth trying against every other
-- row. `link_hash` is sha256(token); the token carries its own 256 bits so it
-- needs no binding, and UNIQUE gives the callback an index-backed lookup.
--
-- `redirect_uri` is the origin-validated destination the magic-link callback
-- redirects to with the token pair in the URL fragment. It is recorded at issue
-- time, never taken from the click, so a link cannot be re-aimed after the fact.
--
-- There is no user_id column: the mailbox IS the key on this path. The Zitadel
-- user is resolved (or created) only after the code verifies, which is what lets
-- any address sign in without a prior registration step.
--
-- Mirrored idempotently in gateway ensureSchema() (lib/db.ts) — keep the two in sync.

CREATE TABLE IF NOT EXISTS public.email_login_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text        NOT NULL,
  code_hash    text        NOT NULL,
  link_hash    text        NOT NULL UNIQUE,
  redirect_uri text,
  attempts     int         NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The verification lookup: newest live code for a mailbox.
CREATE INDEX IF NOT EXISTS idx_email_login_codes_live
  ON public.email_login_codes (email, created_at DESC) WHERE consumed_at IS NULL;

-- Serves both the per-mailbox send throttle (count since a timestamp) and the
-- daily purge of spent rows.
CREATE INDEX IF NOT EXISTS idx_email_login_codes_created
  ON public.email_login_codes (created_at);

-- No RLS — only accessed from the gateway with the service role.
