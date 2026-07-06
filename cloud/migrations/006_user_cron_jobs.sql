-- Externalized cron for scale-to-zero compute pods.
--
-- Each row is one project-app cron hook for one user. The pod publishes its
-- schedule (POST /api/compute/cron-manifest); the always-on gateway wakes the
-- pod at `next_run_at` so cron fires on wall-clock schedule even while the pod is
-- scaled to zero. Mirrored idempotently in gateway ensureSchema() (lib/db.ts).

CREATE TABLE IF NOT EXISTS public.user_cron_jobs (
  user_id       text        NOT NULL,
  project_id    text        NOT NULL,
  slug          text        NOT NULL,
  cron_expr     text        NOT NULL,
  every_ms      bigint      NOT NULL,
  next_run_at   timestamptz NOT NULL,
  last_woken_at timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_user_cron_jobs_next_run
  ON public.user_cron_jobs (next_run_at);
