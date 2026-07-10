# Endpoints used by the wrappers

Base URL (pinned by the gateway): `https://api.github.com`. All paths below are the RELATIVE `path`
you pass to `callConnection('github', { method, path, query?, body?, headers })`. Every call sends
`Accept: application/vnd.github+json` (the wrappers set it).

### Create issue — `githubCreateIssue(repo, title, body?)`
- `POST /repos/{owner}/{repo}/issues` (`repo` is `"owner/repo"`).
- Body: `{ title, body? }`. (Labels/assignees could be added to the body object if needed.)
- Returns the issue `{ number, html_url, title, state, id, ... }`. A 422 means validation failed; a
  404 usually means the repo isn't visible to the connected account.

### List pull requests — `githubListPullRequests(repo, state?)`
- `GET /repos/{owner}/{repo}/pulls`
- Query params: `state` = `open` (default) | `closed` | `all`.
- Returns an ARRAY of PRs `[{ number, title, state, html_url, user, head, base, ... }]`.

### Search code — `githubSearchCode(query)`
- `GET /search/code`
- Query params: `q` — GitHub code-search syntax, e.g. `repo:owner/name`, `language:ts`,
  `in:file`, `path:src`, plus keywords. A bare `q` searches across accessible repos.
- Returns `{ total_count, incomplete_results, items: [{ name, path, repository, html_url }] }`.
- Note: code search requires the query to be reasonably specific; very broad queries may return
  `incomplete_results: true` or a 422.
