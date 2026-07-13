# docs-sync — symbol-anchored citation tooling

Keeps `org/docs` citations true without hand-maintaining line numbers. Implements the
citation grammar and the CI gate defined in [`../../SYNC.md`](../../SYNC.md).

## Why

Every factual sentence in `org/docs` is grounded to the code that makes it true. The old
form, `path:Lstart-Lend`, rots on every edit above the cited line and has to be
re-verified by hand. A **symbol anchor** — `path#Symbol` — moves with the code: it breaks
only when the cited symbol is renamed or removed, which is exactly when the claim needs
re-checking. Line anchors are kept where a symbol isn't a clean fit (config files, a
precise line inside a large function, a range spanning two symbols).

## Grammar

```
sdk/org/libs/core/src/eval/turn-loop.ts#runTurnLoop          symbol (preferred)
sdk/org/libs/core/src/session/session.ts#Session.resume      dotted: member of a container
sdk/org/libs/css/src/tokens/tokens.json:42-58                line range (fallback)
cloud/gateway/src/lib/tokens.ts:88                            single line
```

Symbols are resolved with the TypeScript compiler API, so any renameable declaration
works: functions, classes, interfaces, enums, namespaces, top-level `const`/`let`, and
their members (`Class.method`, `Interface.field`, `Namespace.fn`). Local variables inside
function bodies are intentionally **not** anchors.

## Commands

Run from anywhere; paths default to this repo layout.

```bash
# The CI gate: fail on any unresolved citation.
node org/docs/tools/docs-sync/check.mjs
node org/docs/tools/docs-sync/check.mjs --json       # machine-readable

# Convert line citations to symbol anchors where a symbol is a clean fit.
node org/docs/tools/docs-sync/migrate.mjs            # dry-run report
node org/docs/tools/docs-sync/migrate.mjs --write    # apply in place
```

Flags: `--docs <dir>` `--repo-root <dir>` `--sdk-org-root <dir>` (or `SDK_ORG_ROOT`).
The last is only needed when the `sdk/org` submodule isn't checked out — point it at a
standalone clone of `github.com/lmthing/org`.

### Baseline (escape hatch — currently unused)

The gate is a hard **zero**: every citation resolves. If a future change ever needs to land
alongside pre-existing drift it can't fix in the same PR, `check.mjs` supports a baseline of
tolerated failures so only *new* breakage fails:

```bash
node check.mjs --update-baseline baseline.json          # record current failures
node check.mjs --baseline baseline.json                 # fail only on NEW ones
```

A baselined entry that later resolves is flagged (`♻ now resolves — remove from baseline`) so the
list only shrinks. There is no baseline file today, and adding one should be a deliberate, temporary
choice — the contract is to fix drift in the same change, not to park it.

## What migration keeps as line anchors (by design)

- non-code files (JSON / YAML / Markdown / shell / CSS)
- a precise line inside a large symbol (anchoring would lose "which line")
- a range that straddles two symbols
- an ambiguous bare name (duplicated in the file)
- anonymous callbacks — e.g. Hono route handlers `router.post("/x", …)` have no named
  symbol; these stay as line anchors

## Known limitation

Route handlers registered as call-expression callbacks (`app.get("/route", handler)`)
are not yet anchorable by symbol. They remain line citations. A future enhancement could
synthesize a route anchor.
