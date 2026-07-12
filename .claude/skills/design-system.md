---
name: design-system
description: Load whenever you touch ANY frontend code (studio/chat/computer in sdk/org, or the product SPAs com/social/team/store/space/blog/casa) — colors, styling, Tailwind classes, component CSS, or theming. The lmthing visual design system is mandatory and enforced.
---

# lmthing design system (mandatory, enforced)

Applies to any change to a web surface: `sdk/org/apps/web`, `@lmthing/css`, `@lmthing/ui`, and the
product SPAs (`com social team store space blog casa`, plus `org`). One hard rule you must not
break: **never write a raw color** — no hex, no literal `rgb()/hsl()`, no stock Tailwind color
utility (`gray-*`, `blue-*`, `slate-800`, …). Use a design token. A violation fails the lint gate
and blocks the merge.

## Read first (the grounded truth)

- `org/docs/design-system/README.md` — the one rule, the lint gate (what it flags, what it does
  **not** scan, the escape hatches), the change workflow, theme modes, the BEM component-CSS pattern.
- `org/docs/design-system/tokens.md` — the token set, the `tokens.json` → `theme.css` + manifest
  pipeline, token groups, the spectrum ramp, light/dark.
- `org/docs/design-system/components.md` — the **display()/ask() UI component catalog** (the
  cross-platform primitives an agent renders). Read it when you touch `@lmthing/core`'s catalog or a
  space component — not for CSS class names.
- `org/docs/libs/ui-and-css.md` — the `@lmthing/css` / `@lmthing/ui` packages themselves.
- `sdk/org/libs/css/COMPONENTS.md` and `sdk/org/libs/css/tokens.manifest.json` — generated indexes
  (rebuilt by `pnpm --filter @lmthing/css generate`; never hand-edit): every component class and its
  tokens; every token's CSS var, Tailwind utility, light/dark value and semantic-role `description`.
  Grep the manifest's descriptions to pick a token by role when migrating a raw color — never
  hand-pick a hex. Token groups are explained in `org/docs/design-system/tokens.md`.

## Procedure — changing a color

1. Edit `sdk/org/libs/css/src/tokens/tokens.json` (the single source of truth).
2. `pnpm --filter @lmthing/css generate` — regenerates `src/theme.css`, `tokens.manifest.json`,
   and `COMPONENTS.md`. **Never hand-edit `theme.css`.**
3. Commit the regenerated outputs alongside the `tokens.json` change.

## Procedure — before you finish any frontend change

1. Run `pnpm lint:tokens` from the repo root and make it pass. (Per-package: `pnpm --filter
   @lmthing/css lint:tokens`, or `@lmthing/ui` / `@lmthing/web-app` — these scan only that package's
   `src`; the root script is the one CI mirrors.)
2. Genuinely non-brand palettes (terminal ANSI, syntax-highlight themes) are the only exception —
   mark them with `ds-lint-ok` (one line) or `ds-lint-file-ok` (whole file). See the "Escape hatches"
   section of `org/docs/design-system/README.md`.
3. Note the gate's blind spots (`store/projects/*/pages/*.tsx`, most `sdk/org/libs/*`, `cloud/`) —
   listed in `org/docs/design-system/README.md`. Passing lint there does not mean the code is clean;
   apply the rule by hand.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the
same change (see `org/docs/SYNC.md`).
