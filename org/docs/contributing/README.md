# Contributing — how to change this codebase

This is the index for **changing lmthing safely**. Every how-to below shares one governing rule,
and every rule here is enforced either by policy ([`../SYNC.md`](../SYNC.md)) or by a CI gate whose
implementation is cited inline.

---

## The golden rule

> **`org/` is the single source of truth for this codebase, and the code is the single source of
> truth for `org/`. A change to code is not done until the `org/` doc that describes it is updated
> in the same change.**

This is the whole contract; the full statement, the definition of "grounded", the `UNVERIFIED`
convention, and the deletion rule live in [`../SYNC.md`](../SYNC.md). The short version:

- Knowledge lives in `org/` **and nowhere else**. `CLAUDE.md` files and `.claude/skills/*` are
  *pointers* to the grounded `org/` doc, not the knowledge itself. When they disagree with `org/`,
  `org/` wins; when `org/` disagrees with the **code**, the **code** wins and `org/` is fixed
  (`../SYNC.md`, "The rule").
- Every factual sentence in `org/` ends with a code citation — `path:Lstart-Lend`, or `path` plus a
  symbol name (`../SYNC.md`, "What 'grounded' means").
- Deleting a feature means deleting its doc in the same change (`../SYNC.md`, "Deleting a feature").

**Which doc moves with your change?** The mapping table is in [`../SYNC.md`](../SYNC.md) ("Which doc
do I update?") — e.g. a runtime global → [`../runtime-globals/`](../runtime-globals/README.md); a
pod route or CLI flag → [`../cli-api/`](../cli-api/README.md); a gateway route/tier →
[`../cloud/`](../cloud/README.md); a file kind → [`../format/`](../format/README.md).

---

## Getting set up

The monorepo is pnpm/Node. Prereqs and first run:

```bash
pnpm install
cd sdk/org/apps/web && pnpm dev        # unified SPA: /studio /computer /chat
```

Root scripts you will use (`package.json:L8-L17`): `pnpm dev` / `pnpm build` (both filter
`./studio`, i.e. `sdk/org/apps/web`), `pnpm lint`, and the token gate `pnpm lint:tokens`. Node
`>=24` and pnpm `10.17.1` are pinned (`package.json:L4-L6`, `:L3`). Running the full local stack
(ports, `*.test` nginx proxy, demo auth, `make` targets) → [`../devops/local-dev.md`](../devops/local-dev.md).

---

## The how-tos

Each guide is a step-by-step recipe grounded in the code it touches. They absorb the procedures that
used to live in `sdk/org/.claude/skills/*` and `.claude/skills/*` (now pointers).

| Task | Guide | Absorbs skill |
|---|---|---|
| Add an agent **runtime global** (inject site, capability gate, DTS) | [`add-a-global.md`](./add-a-global.md) | `sdk/org/.claude/skills/new-global.md` |
| Add a **provider** (web-search / LLM backend) | [`add-a-provider.md`](./add-a-provider.md) | `sdk/org/.claude/skills/new-provider.md`, `.claude/skills/web-search.md` |
| Add a **space** (system space or store integration space) | [`add-a-space.md`](./add-a-space.md) | `sdk/org/.claude/skills/new-space.md` |
| Add a **pricing tier** (cross-cutting gateway/billing checklist) | [`add-a-tier.md`](./add-a-tier.md) | `.claude/skills/add-tier.md` |
| Write & run **tests** | [`testing.md`](./testing.md) | `sdk/org/.claude/skills/writing-tests.md` |
| **Debug** the eval loop / pod / gateway | [`debugging.md`](./debugging.md) | `sdk/org/.claude/skills/debug-eval.md` |

---

## Hard gates (CI will fail you)

These are enforced automatically — check them before you push.

- **Design tokens.** No raw colors anywhere in frontend source. `pnpm lint:tokens`
  (`package.json:L14`) scans `sdk/org/libs/css/src`, `sdk/org/libs/ui/src`, `sdk/org/apps/web/src`
  and every product SPA `*/src`; the same command runs in CI as the *Lint design tokens* step
  (`.github/workflows/design-tokens.yml:L39-L44`). To change a color, edit
  `sdk/org/libs/css/src/tokens/tokens.json` then regenerate
  (`pnpm --filter @lmthing/css generate` → `sdk/org/libs/css/package.json:L27`); never hand-edit
  `theme.css`. Full rules → [`../design-system/README.md`](../design-system/README.md).
- **Images build.** The pod/app/SPA images build in CI on changes under `sdk/org` and the
  root workspace (`.github/workflows/build-images.yml:L13-L16`); some images build from the
  `sdk/org` context with `sdk/org`'s own lockfile (`:L61-L65`), so shared libs must stay inside
  that submodule.
- **GitHub Pages deploy.** Only the build-status page is on Pages; it is deployed as an artifact by `build-images.yml`'s `publish-pages` job. No product SPA is on Pages — they are K8s Deployments.

---

## Verifying a doc change

Before you call a doc change done (`../SYNC.md`, "Verifying"): every relative link resolves, every
`path:Lstart-Lend` citation opens to the code it claims (line numbers drift when you move code), and
no behaviour is left explained only inside a `CLAUDE.md`, skill, README, or long code comment —
that explanation belongs in `org/`.

## See also

- [`../SYNC.md`](../SYNC.md) — the full sync contract (the golden rule in detail)
- [`../README.md`](../README.md) — the documentation hub index
- [`../architecture.md`](../architecture.md) — system & data-flow architecture
