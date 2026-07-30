-- Which browser asked for this sign-in.
--
-- A magic link is a bearer credential that lives in an inbox, and an inbox gets
-- read on whatever device is to hand. Before this column the callback handed a
-- session to whoever opened the link, which is wrong twice over: the browser
-- that actually asked is still sitting on the sign-in page logged out, and a
-- forwarded link is an account takeover.
--
-- `origin_hash` is sha256 of an opaque 256-bit token set as a __Host- cookie on
-- the gateway origin at issue time. The callback completes the login only when
-- the click carries that cookie back; any other click is answered with
-- instructions to type the code — which is already in the same email, so nothing
-- has to be regenerated, displayed, or stored in the clear.
--
-- Nullable, and treated as "no proof available" rather than "trusted": rows
-- issued before this migration, and API-only callers that never had a browser,
-- simply take the instructions path.
--
-- Mirrored idempotently in gateway ensureSchema() (lib/db.ts) — keep the two in sync.

ALTER TABLE public.email_login_codes
  ADD COLUMN IF NOT EXISTS origin_hash text;
