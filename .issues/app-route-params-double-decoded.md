# bug: project-app route params are URL-decoded twice — ids containing %2F or % break

**Symptom:** the pod router decodes every captured param including the `/*` rest capture
(`decodeURIComponent` in `Router.dispatch`), `createAppApiHandler` forwards `'/' + rest`, and the
app API `matchRoute` decodes each `:param` segment **again**. An id containing an encoded slash
(`%2F`) becomes a real separator at the first decode → segment-count mismatch → 404; an id with a
literal `%20` (sent as `%2520`) arrives as a space. LLM-authored apps routinely produce slugs with
`/`, `%`, `#`, `?`. Docs (`org/docs/app/routes.md:62`) document only the second decode.

**Direction:** decode exactly once — either stop decoding the `rest` capture in the pod router
(decode only named params) or stop re-decoding in the app loader. Add a round-trip test that
`GET /app/<p>/api/items/a%2Fb` and `.../items/a%2520b` reach the handler with the literal id.

**Where:** `sdk/org/libs/cli/src/server/router.ts:71` → `sdk/org/libs/cli/src/server/routes/app-api.ts:53`
→ `sdk/org/libs/cli/src/app/api/loader.ts:184`.
