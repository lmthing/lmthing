/**
 * GitHub Issues client — used by the in-app bug reporter to file an issue in
 * the org's repo and stash supporting artifacts (session trace, screenshot)
 * via the Contents API. Uses a plain PAT (classic `repo` scope, or
 * fine-grained with Issues:write + Contents:write), unlike github-app.ts's
 * GitHub App flow — this is a simple, single-token integration with no
 * per-installation scoping needed.
 *
 * Setup (one-time, out of band): mint a PAT with the scopes above, put it in
 * GITHUB_ISSUES_TOKEN. GITHUB_ISSUES_REPO is where issues are filed
 * (default "lmthing/org"). GITHUB_BUGREPORT_REPO is where trace/screenshot
 * artifacts are committed (defaults to the same repo as GITHUB_ISSUES_REPO).
 * All live in the `lmthing-secrets` k8s secret.
 */

const GITHUB_API = "https://api.github.com";

const ISSUES_TOKEN = process.env.GITHUB_ISSUES_TOKEN ?? "";
const ISSUES_REPO = process.env.GITHUB_ISSUES_REPO ?? "lmthing/org";
const BUGREPORT_REPO = process.env.GITHUB_BUGREPORT_REPO || ISSUES_REPO;

export function isIssuesConfigured(): boolean {
  return Boolean(ISSUES_TOKEN);
}

function ghHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${ISSUES_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "lmthing-gateway",
  };
}

/**
 * Strip a leading `data:image/...;base64,` prefix if present, leaving bare
 * base64 — callers may send either a data URL or already-bare base64.
 */
export function normalizeBase64(input: string): string {
  const match = input.match(/^data:[^;]+;base64,(.*)$/s);
  return match ? match[1] : input;
}

export interface UploadedArtifact {
  rawUrl: string;
  blobUrl: string;
}

/**
 * Commit a file to `GITHUB_BUGREPORT_REPO` via the Contents API.
 * `contentBase64` must already be base64-encoded file content.
 */
export async function uploadBugArtifact(
  pathInRepo: string,
  contentBase64: string,
  commitMessage: string,
): Promise<UploadedArtifact> {
  const res = await fetch(
    `${GITHUB_API}/repos/${BUGREPORT_REPO}/contents/${pathInRepo}`,
    {
      method: "PUT",
      headers: ghHeaders(),
      body: JSON.stringify({
        message: commitMessage,
        content: contentBase64,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub artifact upload failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as {
    content: { html_url: string; download_url: string };
  };
  return { rawUrl: data.content.download_url, blobUrl: data.content.html_url };
}

export interface CreatedIssue {
  url: string;
  number: number;
}

/**
 * File a new issue in `GITHUB_ISSUES_REPO`.
 */
export async function createOrgIssue(input: {
  title: string;
  body: string;
}): Promise<CreatedIssue> {
  const res = await fetch(`${GITHUB_API}/repos/${ISSUES_REPO}/issues`, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ title: input.title, body: input.body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub issue creation failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as { html_url: string; number: number };
  return { url: data.html_url, number: data.number };
}
