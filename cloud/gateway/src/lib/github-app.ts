import { SignJWT } from "jose";
import { createPrivateKey } from "node:crypto";

/**
 * GitHub App client — the gateway is the sole custodian of the App's private
 * key. It mints short-lived, repo-scoped installation access tokens on demand
 * (for the compute pod to `git push`/`pull` a user's workspace backup), so no
 * long-lived GitHub credential is ever stored in a user pod.
 *
 * Setup (one-time, out of band): create a GitHub App with **Contents: read &
 * write** + **Metadata: read**, no webhooks. Put its numeric App ID in
 * GITHUB_APP_ID, its private key PEM in GITHUB_APP_PRIVATE_KEY, and its public
 * slug in GITHUB_APP_SLUG (used to build the install URL). All three live in
 * the `lmthing-secrets` k8s secret.
 */

const APP_ID = process.env.GITHUB_APP_ID ?? "";
// The PEM may arrive with literal "\n" sequences (common when stored as a
// single-line k8s secret value); normalise them back to real newlines.
const PRIVATE_KEY = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(
  /\\n/g,
  "\n",
);
export const APP_SLUG = process.env.GITHUB_APP_SLUG ?? "";

const GITHUB_API = "https://api.github.com";

export function isGithubAppConfigured(): boolean {
  return Boolean(APP_ID && PRIVATE_KEY && APP_SLUG);
}

/**
 * A short-lived (≤10 min) RS256 JWT signed with the App private key, used to
 * authenticate as the App itself when minting installation tokens.
 */
async function appJwt(): Promise<string> {
  // GitHub App keys download in PKCS#1 (`BEGIN RSA PRIVATE KEY`); jose's
  // importPKCS8 only accepts PKCS#8 (`BEGIN PRIVATE KEY`). node's
  // createPrivateKey parses both, so users can paste the key GitHub gives them
  // verbatim. The returned KeyObject is accepted directly by SignJWT.sign().
  const key = createPrivateKey(PRIVATE_KEY);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    // Backdate iat by 60s to tolerate minor clock skew against GitHub.
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(APP_ID)
    .sign(key);
}

export interface InstallationToken {
  token: string;
  expiresAt: string;
}

/**
 * Mint an installation access token scoped to a single repository with
 * contents:write. `repoName` is the bare repo name (no owner) — the
 * installation already fixes the owning account.
 */
export async function mintInstallationToken(
  installationId: string,
  repoName: string,
): Promise<InstallationToken> {
  const jwt = await appJwt();
  const res = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "lmthing-gateway",
      },
      body: JSON.stringify({
        repositories: [repoName],
        permissions: { contents: "write" },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GitHub installation token failed: ${res.status} — ${text}`,
    );
  }

  const data = (await res.json()) as { token: string; expires_at: string };
  return { token: data.token, expiresAt: data.expires_at };
}

export type RepoCheck =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-empty"; branches: string[] };

/**
 * Validate a backup target repo before we save it: the user is expected to have
 * already created an EMPTY private repo and granted the App access to it. We
 * reject (a) a repo the installation can't see (missing, or App not installed on
 * it) and (b) a non-empty repo — i.e. one that has any branch other than our own
 * `backupBranch` (so re-saving an existing lmthing backup still passes). We never
 * create the repo: GitHub's repo-creation endpoints need a user token, not an
 * installation token.
 */
export async function checkBackupRepo(
  installationId: string,
  owner: string,
  repo: string,
  backupBranch: string,
): Promise<RepoCheck> {
  const jwt = await appJwt();
  // A token across all repos the installation can access — don't scope it to
  // `repo`, since scoping to one the installation can't see would 422 and hide
  // the not-found case we specifically want to detect.
  const tokRes = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "lmthing-gateway",
      },
      body: JSON.stringify({ permissions: { contents: "read", metadata: "read" } }),
    },
  );
  if (!tokRes.ok) {
    throw new Error(
      `GitHub installation token failed: ${tokRes.status} — ${await tokRes.text()}`,
    );
  }
  const { token } = (await tokRes.json()) as { token: string };
  const gh = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "lmthing-gateway",
  };

  const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: gh });
  // GitHub returns 404 both for a missing repo and one outside the installation.
  if (repoRes.status === 404) return { ok: false, reason: "not-found" };
  if (!repoRes.ok) {
    throw new Error(`GitHub repo check failed: ${repoRes.status} — ${await repoRes.text()}`);
  }

  // Empty repo → []. After a backup → [backupBranch]. A real project → other
  // branches. Any non-backup branch means "not empty".
  const brRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=100`,
    { headers: gh },
  );
  if (!brRes.ok) {
    throw new Error(`GitHub branch list failed: ${brRes.status} — ${await brRes.text()}`);
  }
  const branches = ((await brRes.json()) as { name: string }[]).map((b) => b.name);
  const foreign = branches.filter((b) => b !== backupBranch);
  if (foreign.length > 0) return { ok: false, reason: "not-empty", branches: foreign };
  return { ok: true };
}

/**
 * The URL that starts the App install flow. `state` round-trips through GitHub
 * back to our callback so we can attribute the installation to a user.
 */
export function installUrl(state: string): string {
  return `https://github.com/apps/${APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;
}
