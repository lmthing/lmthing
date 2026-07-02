-- Per-user GitHub workspace-backup configuration.
--
-- Backs the "back up / restore the compute-pod workspace to a user-owned GitHub
-- repo" feature. The gateway is the GitHub App credential custodian; this table
-- records each user's App installation, their chosen target repo, and the
-- auto-backup schedule. Mirrored idempotently in gateway db.ts ensureSchema().

CREATE TABLE IF NOT EXISTS public.backup_config (
  user_id text PRIMARY KEY,
  installation_id text,
  repo text,
  auto boolean NOT NULL DEFAULT false,
  interval_minutes int NOT NULL DEFAULT 60,
  branch text NOT NULL DEFAULT 'lmthing-backup',
  last_backup_at timestamptz,
  last_commit_sha text,
  status text,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
