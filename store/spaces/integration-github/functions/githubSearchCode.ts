/**
 * Search code across repositories the user can access (GET /search/code).
 *
 * @param query  GitHub code-search query, e.g. "addClass repo:jquery/jquery" or
 *               "callConnection in:file language:ts".
 * @returns The code-search payload: { total_count: number; incomplete_results: boolean; items: { name, path, repository, html_url }[] }
 */
export async function githubSearchCode(query: string): Promise<any> {
  const r = await callConnection('github', {
    method: 'GET',
    path: '/search/code',
    query: { q: query },
    headers: { Accept: 'application/vnd.github+json' },
  });
  return r.data;
}
