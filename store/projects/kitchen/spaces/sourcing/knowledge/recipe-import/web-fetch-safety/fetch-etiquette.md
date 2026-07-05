# Fetch etiquette

## `functions:` gates the web globals too

`webFetch`, `webSearch`, and `fetch` are universal system globals available to any agent or task in
principle — they aren't declared per-space the way `parseRecipe` or `matchIngredient` are. But
that doesn't mean they're always in scope: both an agent's and a task's `functions:` frontmatter key
is an **allowlist**, and when it's present it gates system globals exactly the same way it gates
space functions. A task that needs to fetch a page must explicitly list `webFetch` (and usually
`webSearch`/`fetch` alongside it) in its own `functions:` — inheriting from the agent, or from a
sibling task in the same tasklist, is not how the grant works. Omitting `functions:` entirely means
"everything is allowed" (including the web globals); listing `functions: []` means "nothing is
allowed" (including the web globals) — there is no middle state where system globals sneak through
a narrower list. This is exactly why the `import` tasklist's `fetch-page` task carries an explicit
`functions: [webFetch, webSearch, fetch, parseRecipe]` even though later tasks in the same tasklist
don't need the web at all and correctly omit it from their own lists.

## First statement, no exploration

Once `webFetch` is actually in scope, call it directly as close to the first real statement as
possible. There's no filesystem to explore, no other way to "look for" a page — the URL is either
known (pasted in chat, or read off a stub `recipes` row) or it isn't, and if it is, the very next
step is `await webFetch(url)`. Treating web access as something to be cautious or exploratory about
just adds latency without adding safety; the actual safety work happens after the fetch returns; see
`content-trust.md`.

## A failed or empty fetch is a normal outcome, not an error to route around

Pages disappear, block automated fetches, sit behind a paywall, or occasionally just return
malformed content. None of these are exceptional situations that call for a retry loop or a
different fetch strategy — they're a normal, expected fraction of real-world URLs, and the correct
response is the same one used for a page that fetches fine but doesn't parse into a recipe: stop,
and say so plainly. A stub `recipes` row that never gets filled in past `title: 'Importing…'` is a
perfectly fine, honest terminal state. What's not acceptable is quietly treating a failed fetch as
license to fabricate a recipe from the URL's slug or domain name alone — a URL like
`example.com/recipes/lemon-chicken-tenders` contains real information about what the dish probably
is, and that's exactly the kind of plausible-looking shortcut that must be resisted; the recipe has
to come from the page's actual content, not an inference from its address.
