-- Inbound webhook bindings — the pod publishes the project-app webhook hooks
-- it currently has registered (POST /api/compute/webhook-manifest, compute-JWT
-- authed) so the gateway's public inbound broker (/api/inbound/:userToken/:path)
-- knows which (provider, agent) a given path maps to without asking the pod.
-- One row per (user, path); replace-all semantics on each publish, mirroring
-- user_cron_jobs. Mirrored idempotently in gateway ensureSchema() (lib/db.ts) —
-- keep the two in sync.

CREATE TABLE IF NOT EXISTS public.webhook_bindings (
  user_id    text        NOT NULL,
  path       text        NOT NULL,
  provider   text,
  agent_ref  text,
  project_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, path)
);
