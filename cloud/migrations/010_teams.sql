-- Teams — a shared workspace that several people use with their own accounts.
--
-- A team is its own principal, not a share of someone's: it gets its own compute
-- pod (namespace `team-<id>`), its own LiteLLM user (`team-<id>`) with its own
-- budget, and its own Stripe customer. Nothing is billed to a member and no
-- member's personal keys are involved.
--
-- Only membership lives here. Tier truth stays in LiteLLM user metadata for the
-- `team-<id>` principal, exactly as it does for users — there is deliberately no
-- `tier` column to drift from it. Everything else a team owns (cron jobs,
-- webhook bindings, backup config) reuses the existing `user_id`-keyed tables
-- with the value `team-<id>`, so no schema change is needed there.
--
-- Mirrored idempotently in gateway ensureSchema() (lib/db.ts) — keep the two in sync.

CREATE TABLE IF NOT EXISTS public.teams (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  created_by         text        NOT NULL,
  stripe_customer_id text        UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- `email` is denormalized at add/accept time so the roster and pod-side message
-- attribution never need an N-lookup round trip to Zitadel.
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id    uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    text        NOT NULL,
  email      text        NOT NULL,
  role       text        NOT NULL CHECK (role IN ('viewer', 'editor')),
  invited_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user
  ON public.team_members (user_id);

-- Invites for people who don't have an lmthing account yet (there is no mailer:
-- the inviter shares the lmthing.team link, the invitee signs up and sees the
-- pending invite for their verified email). `email` is stored lowercased.
CREATE TABLE IF NOT EXISTS public.team_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL CHECK (role IN ('viewer', 'editor')),
  invited_by  text        NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_pending
  ON public.team_invites (team_id, email) WHERE accepted_at IS NULL;
