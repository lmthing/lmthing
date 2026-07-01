---
name: design-system
description: Load whenever you touch ANY frontend code (studio/chat/computer in sdk/org, or the product SPAs com/social/team/store/space/blog/casa) — colors, styling, Tailwind classes, component CSS, or theming. The lmthing visual design system is mandatory and enforced.
---

# lmthing design system (mandatory, enforced)

One token-driven design system for every web surface. The **canonical spec** lives in the
`sdk/org` submodule:

- **[sdk/org/libs/css/DESIGN.md](../../sdk/org/libs/css/DESIGN.md)** — the full rulebook + the raw→token mapping table. **Read this before styling anything.**
- **sdk/org/libs/css/src/tokens/tokens.json** — the single source of truth for tokens (edit here).
- **sdk/org/libs/css/tokens.manifest.json** — flat token index (name, cssVar, utility, light, dark).
- **sdk/org/libs/css/COMPONENTS.md** — every component class + the tokens it uses.
- In-submodule skill: `sdk/org/.claude/skills/visual-design-system.md`.

Every app (`sdk/org/apps/web` and the root SPAs) imports `@lmthing/css/theme.css` and uses
`@lmthing/ui`. No app defines its own colors.

## The rules — no exceptions

1. **Never use a raw color.** No hex, no literal `rgb()/hsl()`, no stock Tailwind color
   utilities (`gray-*`, `blue-*`, `green-500`, `slate-800`, …). Use a design token: the CSS
   var (`var(--foreground)`) or its token utility (`bg-primary`, `text-agent`, `border-border`).
   - Allowed: `rgb/hsl(var(--…))`, and achromatic overlays/scrims/shadows with alpha < 1
     (`rgba(0,0,0,.5)`).
   - Genuinely non-brand color sets (terminal ANSI, code-syntax themes): put `ds-lint-file-ok`
     in a top comment, or `ds-lint-ok` on a single line.
2. **Stone, not grey** — neutrals are warm stone; no cool grey/slate/zinc.
3. **Brand is an accent, never a CTA fill** — CTAs use `--primary` (stone). The cozy rainbow
   (`--brand-1..5`, `--spectrum-*`) is for logo letters, per-product tints, hover glows.
4. **THING is multi-color** — render the wordmark with `CozyThingText`
   (`@lmthing/ui/elements/branding/cozy-text`), never a single solid color.
5. **Outline icons only** (`stroke="currentColor"`, `stroke-width 1.5`, `fill="none"`); no emoji in UI.
6. **Dark mode** = `data-theme="dark"` on `<html>` (set by `applyTheme` in `@lmthing/ui/theme`).

## Changing a token

Edit `sdk/org/libs/css/src/tokens/tokens.json` → `pnpm --filter @lmthing/css generate`.
This regenerates `theme.css` (light + dark), `tokens.manifest.json`, and `COMPONENTS.md`.
Never hand-edit `theme.css`.

## Enforcement (hard gate — your change fails CI if it violates)

- Repo-wide: `pnpm lint:tokens` (from repo root).
- Per package: `pnpm --filter @lmthing/css lint:tokens` (or `@lmthing/ui`, `@lmthing/web-app`);
  root SPAs run the `lmthing-lint-tokens` bin on their `src`.
- CI: `.github/workflows/design-tokens.yml` runs on every PR/push touching frontend.

Before finishing any frontend change, run `pnpm lint:tokens` and make it pass.
