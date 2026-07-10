---
variable: githubApi
description: The GitHub REST API surface reached via callConnection('github', ...) — base URL, the required Accept header, the endpoints the wrapper functions use, their parameters, and the gateway-managed auth model.
---

# GitHub REST API cheat-sheet

The agent talks to the GitHub REST API through `callConnection('github', req)`. The gateway pins the
base URL **`https://api.github.com`** and attaches the user's OAuth token — the agent passes only a
RELATIVE `path` and never handles credentials.

Every request must send the `Accept: application/vnd.github+json` header (the wrappers set it in
`req.headers`).

Wrapped endpoints:

- **`POST /repos/{owner}/{repo}/issues`** — open an issue (`githubCreateIssue`).
- **`GET /repos/{owner}/{repo}/pulls`** — list pull requests (`githubListPullRequests`).
- **`GET /search/code`** — search code (`githubSearchCode`).

Repositories are addressed as `"owner/repo"`. Read the returned data and answer from it (a created
issue has `number` + `html_url`); never fabricate issue numbers, URLs, or counts. See the
`endpoints` aspect for exact params and the `auth` aspect for the gateway-managed token model.
