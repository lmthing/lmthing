# Keeping `org/` true — the sync contract

**`org/` is the single source of truth for this codebase, and the code is the single source of
truth for `org/`.** Those two sentences are the whole rule. Everything below is how to honour it.

Knowledge lives **here and nowhere else**. `CLAUDE.md` files and `.claude/skills/*` are *pointers
and procedures* — they route you to the `org/` doc that holds the grounded answer. When they
disagree with `org/`, `org/` wins. When `org/` disagrees with the **code**, the **code** wins and
`org/` is wrong — fix it.

---

## The rule

> **A change to code is not done until the `org/` doc that describes it is updated in the same
> change.**

Not "later", not a follow-up ticket. The doc and the code ship together, or the doc starts lying —
and a lying doc is worse than no doc, because it is trusted.

## What "grounded" means

Every factual sentence in `org/` ends with a citation to the code that makes it true:

```md
An event hook must carry **exactly one** of `handler` or `trigger`; supplying both or neither
throws `sdk/org/libs/cli/src/app/hooks/loader.ts:430-436`.
```

The citation is `path:Lstart-Lend`, or `path` plus a symbol name when lines are unstable. Cite the
**implementation** — the loader, the validator, the route, the global — not another document. An
example file (`store/projects/blog/…`) may be cited for *"what a real one looks like"*, never for
*"this is how it behaves"*.

If you cannot ground a claim, you have two honest options, and inventing a citation is not one of
them:

1. **Don't make the claim.**
2. Mark it, in place, with what you actually searched:
   ```md
   > UNVERIFIED: I could not find where the pod enforces X. Searched `rg 'X' sdk/org/libs/cli/src`,
   > read `server/router.ts` and `routes/app-api.ts` — no enforcement site exists.
   ```

An `UNVERIFIED` line is a debt marker, not a resting place. It is a good-faith admission that the
doc has outrun the code — and very often it is telling you the *code* is wrong (a dead route, an
unreachable branch, a feature that was documented but never built).

## Which doc do I update?

Find your change on the left; that's the doc that must move with it.

| You changed… | Update |
|---|---|
| a file kind an agent/app author writes (`database/*.json`, `api/**`, `pages/**`, `hooks/*`, `events/*`, `agents/*`, `tasklists/*`, `knowledge/*`, `components/*`) | [`format/`](./format/README.md) — the matching file-kind doc |
| a runtime global, or the capability gating one | [`runtime-globals/`](./runtime-globals/README.md) |
| the eval/turn loop, typecheck/DTS, forks, delegation, space loading, sessions | [`runtime/`](./runtime/README.md) |
| a `lmthing` CLI command/flag, or a pod `/api/*` route | [`cli-api/`](./cli-api/README.md) |
| a route/feature/view in the `/chat`, `/studio`, or `/computer` SPA | [`chat/`](./chat/README.md) · [`studio/`](./studio/README.md) · [`computer/`](./computer/README.md) |
| how an installed project-app is served, built, or executed | [`app/`](./app/README.md) |
| a gateway route, auth, billing, a tier, LiteLLM, the render service | [`cloud/`](./cloud/README.md) |
| a design token, the token pipeline, or the UI catalog | [`design-system/`](./design-system/README.md) |
| a shared lib's public API (`@lmthing/state`, `ui`, `css`, `auth`, `openclaw-compat`) | [`libs/`](./libs/README.md) |
| k8s, CI, the image build, the local stack | [`devops/`](./devops/README.md) |
| a shipped system space (THING, appbuilder, architect, …) | [`system-spaces/`](./system-spaces/README.md) |
| a product SPA (`com`, `social`, `team`, `store`, `space`, `blog`, `casa`) | [`product-spas/`](./product-spas/README.md) |
| the domain map, the pod model, the overall data flow | [`architecture.md`](./architecture.md) |

Adding a whole capability with no home above? Add a section — and add its row here.

## Deleting a feature

Delete its documentation in the same change. A doc for a feature that no longer exists is the most
expensive kind of wrong: it sends the next reader hunting for code that isn't there.

## Verifying

Before you call a doc change done:

- **Links resolve.** Every relative link in `org/` must point at a file that exists.
- **Citations are real.** Open each `path:Lstart-Lend` you wrote. Line numbers drift — if you moved
  code, you moved someone's citation.
- **No orphan knowledge.** If you found yourself explaining behaviour inside a `CLAUDE.md`, a skill,
  a README, or a long code comment — that explanation belongs in `org/`. Put it here and link to it.

## Why this is worth the friction

The docs in this repo were, until recently, spread across a dozen half-true specs — a format doc
that had drifted from the loader, a capability table missing five grants, a "computer-use surface"
with no implementing code, a tier gate that didn't exist. Grounding everything to code found all of
that, because **a citation you cannot write is a bug you have just discovered.**

That is the real value of the rule. Keeping `org/` honest is not documentation hygiene — it is a
standing audit of the codebase, run every time you touch it.
