# Design system (mandatory, enforced)

Every lmthing web surface — the studio/chat/computer app (`sdk/org/apps/web`), the shared
component libraries (`@lmthing/css`, `@lmthing/ui`), and the product SPAs
(`com social team store space blog casa`) — shares ONE token-driven design system in
`@lmthing/css`. The authoritative spec is [`sdk/org/libs/css/DESIGN.md`](../../sdk/org/libs/css/DESIGN.md);
this page is the code-grounded operational summary: the one hard rule, the exact enforcement
gate (and what it does **not** cover), and the change workflow.

See also: [tokens.md](./tokens.md) (the token set + how a token becomes a CSS var and a
Tailwind utility) · [components.md](./components.md) (the BEM component-CSS pattern + the
generated catalog) · [../libs/ui-and-css.md](../libs/ui-and-css.md) (the packages themselves).

## The one rule: never write a raw color

Use a **design token** — the CSS var (`var(--foreground)`) or its Tailwind utility
(`bg-primary`, `text-agent`, `border-border`). Never a hex literal, never a literal
`rgb()/hsl()`, never a stock Tailwind color utility (`gray-*`, `blue-*`, `green-500`, …).
This is stated as non-negotiable rule #1 in `sdk/org/libs/css/DESIGN.md:18-25` and enforced
by the lint gate below.

Two categories are **legitimately allowed** and are not flagged
(`sdk/org/libs/css/scripts/lint-design-tokens.mjs:42-57` `funcAllowed`):

- Token-backed color functions: `rgb(var(--…))` / `hsl(var(--…))` — any function whose
  args contain `var(`.
- **Achromatic** overlays/scrims/shadows with alpha < 1: `rgba(0,0,0,.5)`,
  `rgba(255,255,255,.7)` — grey/black/white where R==G==B (or hsl saturation starting `0`)
  and alpha < 1. No token exists for these.

To change a color, or to see the full palette and its semantic roles, go to
[tokens.md](./tokens.md). Do not hand-pick a hex to migrate a raw color — the mapping table
(`sdk/org/libs/css/DESIGN.md:75-91`) picks a token by semantic role.

## The enforcement gate

### The linter

`sdk/org/libs/css/scripts/lint-design-tokens.mjs` walks a set of directories, reads every
`.css/.tsx/.ts/.jsx` file (`lint-design-tokens.mjs:27`), and prints + fails (exit 1) on any
finding (`lint-design-tokens.mjs:120-131`). It flags three kinds
(`lint-design-tokens.mjs:100-116`):

1. **`stock-tailwind-color`** — a stock Tailwind color-family utility, with optional variant
   prefixes and opacity suffix, e.g. `hover:bg-blue-500`, `text-gray-400/50`. The families are
   the full stock list `slate|gray|zinc|neutral|stone|red|orange|…|rose` on any of
   `bg text border ring from via to fill stroke outline decoration shadow accent caret divide placeholder` at shades `50–950` (`lint-design-tokens.mjs:36-38`).
2. **`raw-hex`** — a `#rgb`, `#rrggbb`, or `#rrggbbaa` literal (`lint-design-tokens.mjs:39`).
3. **`raw-color-fn`** — an `rgb()/rgba()/hsl()/hsla()` that is neither token-based nor an
   achromatic overlay (`lint-design-tokens.mjs:40`, `funcAllowed`).

**Files always skipped**, regardless of directory (`lint-design-tokens.mjs:30-34` `ALLOW_FILE`,
applied at `:94`) — these hold raw values by design:

- `theme.css` (the generated theme — see below)
- `tokens.json` and `tokens.manifest.json` (the source + generated token index)
- anything whose path contains `scripts/`

**Directories always pruned during the walk** (`lint-design-tokens.mjs:28`):
`node_modules dist .turbo .git build coverage`.

### The two triggers that run it

- **Root script**: `pnpm lint:tokens` — `package.json:11` runs the linter over EXACTLY these
  ten roots:

  ```
  sdk/org/libs/css/src  sdk/org/libs/ui/src  sdk/org/apps/web/src
  com/src  social/src  team/src  store/src  space/src  blog/src  casa/src
  ```

- **CI hard gate**: `.github/workflows/design-tokens.yml` runs the identical command
  (`design-tokens.yml:39-43`) on every `pull_request` and on `push` to `main`
  (`design-tokens.yml:6-27`), but only when files under `sdk/org/**`, `com/** … casa/**`
  change (the path filter). A violation fails the check and blocks the merge.

> Note: `@lmthing/css`'s own `pnpm --filter @lmthing/css lint`/`lint:tokens`
> (`sdk/org/libs/css/package.json:29-30`) only scans that package's `src`; the repo-wide
> coverage comes from the root `lint:tokens` above, which is what CI runs.

### What is NOT scanned (report honestly)

The gate covers only the ten `src` roots listed above. Everything else is invisible to it —
a raw color there will ship un-flagged:

- **`store/projects/<id>/pages/*.tsx`** — the client-side React pages of the shipped
  project-apps (`blog health kitchen trips demo-feed homes`). The gate scans `store/src`
  (the lmthing.store SPA), **not** `store/projects/`. Project-app pages authored by
  `system-appbuilder` are outside the gate.
- **Other `sdk/org/libs/*`** — only `libs/css/src` and `libs/ui/src` are scanned. `libs/state`,
  `libs/auth`, `libs/utils`, `libs/cli`, `libs/core`, `libs/openclaw-compat`, `libs/config`
  are not (most have no web UI, but `libs/cli` ships DevTools/render web code that escapes).
- **`sdk/org/system-spaces/`** — system-space assets/components are not scanned.
- **`cloud/`** — the backend (gateway + LiteLLM). No product frontend, not scanned.
- **`devops/ org/ gh-pages/ automation/ app-specifications/ scratch/ src/`** — not scanned.
- **Non-`src` subtrees of a scanned product** — e.g. `com/public/…`; only `com/src` is walked.
- **Extensions other than `.css .tsx .ts .jsx`** — e.g. inline `<style>` in `.html`,
  `.mjs` config (`lint-design-tokens.mjs:27`).

### Escape hatches

When a raw color is genuinely non-brand (terminal ANSI palettes, syntax-highlight themes):

- Put `ds-lint-ok` in a comment on the offending line — that single line is skipped
  (`lint-design-tokens.mjs:99`).
- Put `ds-lint-file-ok` anywhere in the file — the whole file is skipped
  (`lint-design-tokens.mjs:96`).

## Changing a color (the only supported workflow)

The **single source of truth** is `sdk/org/libs/css/src/tokens/tokens.json`
(`tokens.json:6-8`, `DESIGN.md:7`). Never hand-edit the generated outputs.

1. Edit `src/tokens/tokens.json` (each color has `name`, `group`, `light`, `dark`,
   `description`).
2. Regenerate: `pnpm --filter @lmthing/css generate` — the `generate` script runs both
   generators (`sdk/org/libs/css/package.json:27`), and `prebuild` re-runs them before any
   build (`package.json:28`).
3. Commit the regenerated `src/theme.css`, `tokens.manifest.json`, and `COMPONENTS.md`
   alongside the `tokens.json` change.

`generate-theme.mjs` (`scripts/generate-theme.mjs`) reads `tokens.json` and writes two
outputs (never hand-edit either — `generate-theme.mjs:6-10`, `DESIGN.md:9`):

- **`src/theme.css`** — the Tailwind v4 theme: an `@theme` block for the non-color scales
  (radius, fonts), an `@theme inline` block exposing each color as a `--color-<name>` utility
  (so `bg-primary`/`text-agent` work), a `:root` block with the light values, and a
  `[data-theme="dark"]` block with only the dark overrides (`generate-theme.mjs:65-104`).
  The dark selector comes from `tokens.json` `$meta.darkSelector` (`generate-theme.mjs:73`).
- **`tokens.manifest.json`** — the flat, machine-readable index (name, `cssVar`, `utility`,
  group, light, dark, description) for humans and LLMs (`generate-theme.mjs:106-130`).

The generator also **interpolates the spectrum**: `--spectrum-1..50`, a 50-stop linear-RGB
ramp between the five brand anchors `brand-1..5` (`generate-theme.mjs:22-63`,
`tokens.json` `spectrum`). Detail on the token set → [tokens.md](./tokens.md).

`generate-components-catalog.mjs` regenerates `COMPONENTS.md`, scanning every component
stylesheet under `src/{elements,components}/**` and listing its BEM classes and the tokens it
references (`scripts/generate-components-catalog.mjs:1-24`). Detail → [components.md](./components.md).

## Theme modes (light / dark)

One theme, two modes (`DESIGN.md:40-41`). Every app imports `@lmthing/css/theme`
(`sdk/org/libs/css/package.json:7`); no app redefines tokens. Mode is a `data-theme`
attribute on `<html>`, driven by `@lmthing/ui/theme` (`sdk/org/libs/ui/src/theme/theme.ts`):

- `applyTheme(theme)` sets `document.documentElement`'s `data-theme` and persists to
  `localStorage` key `lm-theme` (`theme.ts:12`, `:19-27`).
- `initTheme(fallback)` reads the stored choice and applies it on boot (`theme.ts:29-38`).
- `useTheme()` is the React hook (`[theme, setTheme, toggle]`) for a switcher (`theme.ts:51-61`).
- `applyThemeTokens(tokens)` lets a space override individual `--lm-*` tokens at runtime from
  its optional `theme.json` (`theme.ts:41-49`).

The generated `[data-theme="dark"]` block carries only the tokens whose dark value differs
from light (`generate-theme.mjs:69-71`); the brand and spectrum ramp are identical across
modes (`tokens.json` `$meta`, `spectrum.description`).

## Related conventions (grounded)

- **Full-spectrum rotation** — spread the cozy rainbow across repeated UI (avatars, sidebar
  sections, tabs) with `@lmthing/ui/lib/spectrum`: `spectrumVar(i)`/`brandVar(i)` return
  `var(--spectrum-N)`/`var(--brand-N)` (cycling), and `spectrumColor(key)`/`brandColor(key)`
  pick a stable color from a string hash (`sdk/org/libs/ui/src/lib/spectrum.ts`). Never
  hand-pick a hex for rotation.
- **THING wordmark is multi-color** — render with `CozyThingText`
  (`sdk/org/libs/ui/src/elements/branding/cozy-text/index.tsx`), each letter its own brand
  color; never a single solid color (`DESIGN.md:35-37`).
- **Legacy `--lm-*` bridge (chat surface)** — the chat components still use `--lm-*` vars, but
  `chat/app/styles.css` aliases every `--lm-*` to a shared token (`--lm-bg: var(--background)`,
  …), so they are theme-aware and pass the gate; `lm-*` is sanctioned, don't churn it
  (`DESIGN.md:110-117`).
- **Component styling pattern** — BEM component CSS is canonical: a stylesheet under
  `src/{elements,components}/<name>/index.css` using `@reference` + `@apply` with tokens; the
  React component imports it and uses the classes (`DESIGN.md:93-108`). Inline Tailwind
  utilities are only for trivial one-off layout. Full detail → [components.md](./components.md).

## Example: a token-only component stylesheet

Real excerpt — `sdk/org/libs/css/src/elements/content/badge/index.css` is catalogued in
`COMPONENTS.md` as using tokens `border, brand-1, muted, muted-foreground, primary,
primary-foreground, secondary, secondary-foreground` and no raw colors:

```css
@reference "../../../theme.css";

.badge {
  @apply inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
         border border-border bg-secondary text-secondary-foreground;
}
.badge--primary {
  @apply bg-primary text-primary-foreground border-transparent;
}
.badge--success {
  @apply bg-brand-1/20 text-brand-1 border-brand-1/30;
}
```

Every color is a token utility, so the file passes `lint:tokens` and re-themes automatically
in dark mode.
