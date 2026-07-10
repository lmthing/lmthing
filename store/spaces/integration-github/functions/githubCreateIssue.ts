/**
 * Open a new issue on a repository (POST /repos/{owner}/{repo}/issues).
 *
 * @param repo   Repository as "owner/repo" (e.g. "lmthing/org").
 * @param title  Issue title.
 * @param body   Optional issue body (Markdown).
 * @returns The created issue resource: { number: number; html_url: string; title: string; state: string; id: number }
 */
export async function githubCreateIssue(repo: string, title: string, body?: string): Promise<any> {
  const r = await callConnection('github', {
    method: 'POST',
    path: '/repos/' + repo + '/issues',
    body: body ? { title, body } : { title },
    headers: { Accept: 'application/vnd.github+json' },
  });
  return r.data;
}
