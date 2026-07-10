/**
 * List a repository's pull requests (GET /repos/{owner}/{repo}/pulls).
 *
 * @param repo   Repository as "owner/repo" (e.g. "lmthing/org").
 * @param state  "open" (default), "closed", or "all".
 * @returns An array of pull-request resources: { number, title, state, html_url, user, head, base }[]
 */
export async function githubListPullRequests(repo: string, state?: string): Promise<any> {
  const r = await callConnection('github', {
    method: 'GET',
    path: '/repos/' + repo + '/pulls',
    query: { state: state ?? 'open' },
    headers: { Accept: 'application/vnd.github+json' },
  });
  return r.data;
}
