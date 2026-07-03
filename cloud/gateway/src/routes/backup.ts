import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  signBackupToken,
  verifyBackupToken,
  signInstallState,
  verifyInstallState,
} from "../lib/tokens.js";
import {
  installUrl,
  mintInstallationToken,
  isGithubAppConfigured,
  checkBackupRepo,
} from "../lib/github-app.js";
import {
  getBackupConfig,
  setBackupInstallation,
  setBackupSettings,
} from "../lib/db.js";
import { getEnvVars, setEnvVars } from "../lib/compute.js";
import type { Env } from "../types.js";

const backup = new Hono<Env>();

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const DEFAULT_BRANCH = "lmthing-backup";

// GET /install-url — the URL that starts the GitHub App install flow. The
// caller passes ?redirect_to=<settings page> so the post-install callback can
// send the user back where they came from.
backup.get("/install-url", authMiddleware, async (c) => {
  if (!isGithubAppConfigured()) {
    return c.json({ error: "GitHub backup is not configured" }, 503);
  }
  const user = c.get("user");
  const redirectTo = c.req.query("redirect_to") ?? "";
  const state = await signInstallState(user.id, redirectTo);
  return c.json({ url: installUrl(state) });
});

// GET /callback — GitHub redirects here after the user installs the App.
// Public (GitHub has no gateway auth); the signed `state` ties it to the user.
backup.get("/callback", async (c) => {
  const installationId = c.req.query("installation_id");
  const state = c.req.query("state");
  if (!installationId || !state) {
    return c.text("Missing installation_id or state", 400);
  }
  const verified = await verifyInstallState(state);
  if (!verified) {
    return c.text("Invalid or expired install state", 400);
  }
  try {
    await setBackupInstallation(verified.userId, installationId);
  } catch (err) {
    console.error(`Failed to store backup installation for ${verified.userId}:`, err);
    return c.text("Failed to record installation", 500);
  }
  const dest = verified.redirectTo || "/";
  return c.redirect(dest);
});

// GET /config — the user's current backup config (never returns a token).
backup.get("/config", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    const cfg = await getBackupConfig(user.id);
    return c.json({
      configured: isGithubAppConfigured(),
      connected: Boolean(cfg?.installation_id),
      repo: cfg?.repo ?? "",
      auto: cfg?.auto ?? false,
      intervalMinutes: cfg?.interval_minutes ?? 60,
      branch: cfg?.branch ?? DEFAULT_BRANCH,
      lastBackupAt: cfg?.last_backup_at ?? null,
      lastCommitSha: cfg?.last_commit_sha ?? null,
      status: cfg?.status ?? null,
      error: cfg?.error ?? null,
    });
  } catch (err) {
    console.error(`Failed to get backup config for ${user.id}:`, err);
    return c.json({ error: "Failed to fetch backup config" }, 500);
  }
});

// PUT /config — save repo + auto + interval, and inject the operational config
// (plus a scoped backup JWT) into the pod's env so it can run backups.
backup.put("/config", authMiddleware, async (c) => {
  const user = c.get("user");

  let body: { repo?: unknown; auto?: unknown; intervalMinutes?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  if (!REPO_RE.test(repo)) {
    return c.json({ error: 'repo must be in "owner/name" form' }, 400);
  }
  const auto = body.auto === true;
  let intervalMinutes =
    typeof body.intervalMinutes === "number" ? Math.floor(body.intervalMinutes) : 60;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5) intervalMinutes = 5;
  if (intervalMinutes > 1440) intervalMinutes = 1440;

  // The repo must already exist, be reachable by the App, and be empty (or a
  // prior lmthing backup). We never create it — creating a user-owned repo needs
  // a user token, not an installation token. Validate up-front so the user gets
  // a clear message instead of a later push failure.
  const cfg0 = await getBackupConfig(user.id);
  if (!cfg0?.installation_id) {
    return c.json({ error: "Connect GitHub first, then choose a repository." }, 400);
  }
  const [owner, name] = repo.split("/");
  try {
    const check = await checkBackupRepo(cfg0.installation_id, owner, name, DEFAULT_BRANCH);
    if (!check.ok && check.reason === "not-found") {
      return c.json(
        {
          error: `Repository "${repo}" not found, or the backup App isn't granted access to it. Create an empty private repo and add it to the App's installation, then try again.`,
        },
        404,
      );
    }
    if (!check.ok && check.reason === "not-empty") {
      return c.json(
        {
          error: `Repository "${repo}" is not empty (found branch(es): ${check.branches.join(", ")}). Use a fresh empty repo so backups can't overwrite existing work.`,
        },
        409,
      );
    }
  } catch (err) {
    console.error(`Repo validation failed for ${user.id} (${repo}):`, err);
    return c.json({ error: "Could not validate the repository with GitHub. Try again." }, 502);
  }

  try {
    await setBackupSettings(user.id, repo, auto, intervalMinutes);

    // Inject operational config into the pod's user-env secret. GET+merge+PUT
    // (setEnvVars replaces the whole secret). No GitHub token is injected — the
    // pod fetches short-lived installation tokens from POST /token on demand.
    const existing = await getEnvVars(user.id);
    const backupJwt = await signBackupToken(user.id);
    await setEnvVars(user.id, {
      ...existing,
      GITHUB_BACKUP_REPO: repo,
      GITHUB_BACKUP_AUTO: auto ? "1" : "0",
      GITHUB_BACKUP_INTERVAL_MIN: String(intervalMinutes),
      GITHUB_BACKUP_BRANCH: DEFAULT_BRANCH,
      LMTHING_BACKUP_JWT: backupJwt,
    });

    return c.json({ ok: true });
  } catch (err) {
    console.error(`Failed to save backup config for ${user.id}:`, err);
    return c.json({ error: "Failed to save backup config" }, 500);
  }
});

// POST /token — called BY THE POD (not the browser) to mint a short-lived,
// repo-scoped GitHub App installation token. Authenticated with the scoped
// backup JWT that was injected into the pod's env, not the user access token.
backup.post("/token", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization" }, 401);
  }
  const verified = await verifyBackupToken(header.slice(7));
  if (!verified) {
    return c.json({ error: "Invalid backup token" }, 401);
  }

  const cfg = await getBackupConfig(verified.userId);
  if (!cfg?.installation_id || !cfg.repo) {
    return c.json({ error: "Backup not connected" }, 409);
  }

  const repoName = cfg.repo.split("/")[1] ?? cfg.repo;
  try {
    const { token, expiresAt } = await mintInstallationToken(
      cfg.installation_id,
      repoName,
    );
    return c.json({ token, expiresAt, repo: cfg.repo, branch: cfg.branch });
  } catch (err) {
    console.error(`Failed to mint installation token for ${verified.userId}:`, err);
    return c.json({ error: "Failed to mint installation token" }, 502);
  }
});

export default backup;
