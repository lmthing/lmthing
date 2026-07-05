---
id: fetch_page
dependsOn: []
role: general
functions: [webFetch, webSearch, fetch, parseRecipe]
output:
  html: string
  targetUrl: string
  recipeId: string
---

Your first statement resolves the actual URL to fetch. A stub row (found via `recipeId`) is the
source of truth over a passed `url` when both are present — this run's job is to fill *that* row
in:

```ts
const stub = recipeId
  ? db.query('recipes', { where: { id: recipeId } })[0]
  : undefined;
const targetUrl = stub?.source || url;
```

Fetch the page. A throw and an empty body both mean "nothing to parse" — resolve with an empty
`html` rather than letting the tasklist die here, so `parse` can report the failure honestly
instead of the run just stopping with no record of why:

```ts
let html = '';
try {
  html = (await webFetch(targetUrl)) ?? '';
} catch {
  html = ''; // fetch failed outright — treated identically to an empty body downstream
}
currentTask.resolve({ html, targetUrl, recipeId: stub?.id ?? recipeId ?? '' });
```

Guardrails:

- Never substitute a guessed or "probably right" URL — `targetUrl` is exactly the stub's `source`
  or the passed `url`, nothing inferred from the URL's slug or domain.
- This task holds the only `functions:` entry with the web globals in this tasklist. A task-level
  `functions:` list is an allowlist that gates system globals too — `parse` and the tasks after it
  never need `webFetch`/`webSearch`/`fetch` again, and correctly leave them out of their own lists.
