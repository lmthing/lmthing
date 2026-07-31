# Design system (mandatory, enforced)

Every lmthing web surface — the studio/chat/computer app (`sdk/org/apps/web`), the shared
component libraries (`@lmthing/css`, `@lmthing/ui`), and the product SPAs
(`com social team store space blog casa`) — shares ONE token-driven design system in
`@lmthing/css`. **This page is the authoritative spec** for it: the one hard rule, the exact
enforcement gate (and what it does **not** cover), and the change workflow. Every claim below
is grounded in the code that makes it true — the token source
(`sdk/org/libs/css/src/tokens/tokens.json`), the generator
(`sdk/org/libs/css/scripts/generate-theme.mjs`) and the gate
(`sdk/org/libs/css/scripts/lint-design-tokens.mjs` — whose own docblock and failure message send
you here, to `org/docs/design-system/`: `lint-design-tokens.mjs:11`, `:129`).

See also: [tokens.md](./tokens.md) (the token set + how a token becomes a CSS var and a
Tailwind utility) · [components.md](./components.md) (the BEM component-CSS pattern + the
generated catalog) · [../libs/ui-and-css.md](../libs/ui-and-css.md) (the packages themselves).

## The one rule: never write a raw color

Use a **design token** — the CSS var (`var(--foreground)`) or its Tailwind utility
(`bg-primary`, `text-agent`, `border-border`). Never a hex literal, never a literal
`rgb()/hsl()`, never a stock Tailwind color utility (`gray-*`, `blue-*`, `green-500`, …).
The rule is stated by the gate itself — "Fails (exit 1) when source uses colors that bypass
the token system … Use a design token instead: `var(--foreground)`, `bg-primary`, `text-agent`"
(`sdk/org/libs/css/scripts/lint-design-tokens.mjs:5-10`) — and enforced by it below.

Two categories are **legitimately allowed** and are not flagged
(`sdk/org/libs/css/scripts/lint-design-tokens.mjs#funcAllowed` `funcAllowed`):

- Token-backed color functions: `rgb(var(--…))` / `hsl(var(--…))` — any function whose
  args contain `var(`.
- **Achromatic** overlays/scrims/shadows with alpha < 1: `rgba(0,0,0,.5)`,
  `rgba(255,255,255,.7)` — grey/black/white where R==G==B (or hsl saturation starting `0`)
  and alpha < 1. No token exists for these.

To change a color, or to see the full palette and its semantic roles, go to
[tokens.md](./tokens.md).

**Design-system mandate (not a lint rule — the linter cannot check it):** when migrating a raw
color, never hand-pick a replacement hex and never reach for the token that merely *looks*
closest. Pick the token whose **semantic role** matches the usage — a page surface is
`background`, a card is `card`, a CTA is `primary`, an error is `destructive`, a knowledge
stream is `knowledge`, an agent stream is `agent`. Every token carries a `description` stating
its role in `sdk/org/libs/css/src/tokens/tokens.json:30-88` (mirrored into the generated
`tokens.manifest.json` — `generate-theme.mjs:120-128`); that description is the mapping table.
A genuinely non-brand palette (terminal ANSI, syntax highlighting) stays raw and is marked
`ds-lint-file-ok` (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:96`, documented at
`lint-design-tokens.mjs:17-20`).

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

- **Root script**: `pnpm lint:tokens` — `package.json:14` runs the linter over EXACTLY these
  eleven roots:

  ```
  sdk/org/libs/css/src  sdk/org/libs/ui/src  sdk/org/apps/web/src
  com/src  social/src  store/src  space/src  blog/src  casa/src
  org/src
  ```

- **CI hard gate**: `.github/workflows/design-tokens.yml` runs the same linter over the same roots
  as the root `pnpm lint:tokens`, on every `pull_request`, on `push` to `main`, and on demand via
  `workflow_dispatch`. A violation fails the check and blocks the merge.

  The path filter lists `sdk/org` **and** `sdk/org/**`. The bare entry is the load-bearing one:
  `sdk/org` is a submodule, so bumping it changes the single gitlink path `sdk/org`, which
  `sdk/org/**` does not match — and a submodule bump is how essentially all `sdk/org` source
  reaches this repo. While that entry was missing the gate simply did not run for those commits.
  Changing the workflow file itself also triggers it, so the gate always runs the gate.

> Note: `@lmthing/css`'s own `pnpm --filter @lmthing/css lint`/`lint:tokens`
> (`sdk/org/libs/css/package.json:28-29`) only scans that package's `src`; the repo-wide
> coverage comes from the root `lint:tokens` above, which is what CI runs.

### What is NOT scanned (report honestly)

The gate covers only the `src` roots listed above. Everything else is invisible to it —
a raw color there will ship un-flagged:

- **`store/projects/<id>/pages/*.tsx`** — the client-side React pages of the shipped
  project-apps (`blog health kitchen trips demo-feed homes` — `store/projects/`). The gate
  scans `store/src` (the lmthing.store SPA), **not** `store/projects/`. Project-app pages
  authored by `system-appbuilder` are outside the gate.
- **Other `sdk/org/libs/*`** — only `libs/css/src` and `libs/ui/src` are scanned. `libs/state`,
  `libs/auth`, `libs/utils`, `libs/cli`, `libs/core`, `libs/config`
  are not. Most have no web UI, but `libs/cli` ships DevTools/render web code that escapes:
  running the linter by hand over `sdk/org/libs/cli/src` reports 15 violations today (e.g. the
  raw hex `#fff` in `sdk/org/libs/cli/src/web/app.tsx:144`).
- **`sdk/org/libs/core/system-spaces/`** — system-space assets/components are not scanned
  (they sit under `libs/core`, which is not a lint root).
- **`cloud/`** — the backend (gateway + LiteLLM). No product frontend, not scanned.
- **`devops/ gh-pages/ automation/ app-specifications/ scratch/`** — not scanned.
- **`org/**` outside `org/src`** — the published docs themselves are prose, not a surface; only
  `org/src` (the lmthing.org SPA) is walked, and it is gated by CI as well as by the root script.
- **Non-`src` subtrees of a scanned product** — e.g. `com/public/…`; only `com/src` is walked.
- **Extensions other than `.css .tsx .ts .jsx`** — e.g. inline `<style>` in `.html`,
  `.mjs` config (`lint-design-tokens.mjs:27`).

### Escape hatches

First check whether you need one: **comments are not scanned**, so prose mentioning a hex or
`rgb()` is not a violation (`lint-design-tokens.mjs#stripComments`). Reach for a hatch only when the
raw color is genuinely non-brand *code* (terminal ANSI palettes, syntax-highlight themes, or a test
whose whole point is that a non-token color passes through untouched):

- Put `ds-lint-ok` in a comment on the offending line — that single line is skipped.
- Put `ds-lint-file-ok` anywhere in the file — the whole file is skipped. Prefer the per-line form:
  a file-level skip also hides every future violation in that file.

## Changing a color (the only supported workflow)

The **single source of truth** is `sdk/org/libs/css/src/tokens/tokens.json` — the file says so
itself ("Single source of truth for the lmthing design system. Edit this file, then run
`pnpm --filter @lmthing/css generate` … Do NOT hand-edit theme.css", `tokens.json:4`
`$meta.description`), and so does the generator that consumes it (`generate-theme.mjs:5`).
Never hand-edit the generated outputs.

1. Edit `src/tokens/tokens.json` (each color has `name`, `group`, `light`, `dark`,
   `description`).
2. Regenerate: `pnpm --filter @lmthing/css generate` — the `generate` script runs both
   generators (`sdk/org/libs/css/package.json:26`), and `prebuild` re-runs them before any
   build (`package.json:27`).
3. Commit the regenerated `src/theme.css`, `tokens.manifest.json`, and `COMPONENTS.md`
   alongside the `tokens.json` change.

`generate-theme.mjs` (`scripts/generate-theme.mjs`) reads `tokens.json` and writes two
outputs (never hand-edit either — `generate-theme.mjs:6-8`; each emitted block is fenced with
an `/* Auto-generated … — edit src/tokens/tokens.json, not this file */` banner,
`generate-theme.mjs:79`):

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

`generate-components-catalog.mjs` regenerates `COMPONENTS.md`: it walks `src/elements` and
`src/components` for every `.css` file except `theme.css`
(`scripts/generate-components-catalog.mjs:18-26`, `:70`) and, per stylesheet, lists the BEM
classes grouped by block plus the tokens it references — both `var(--token)` uses and token
utilities inside `@apply` (`generate-components-catalog.mjs:37-67`). Detail →
[components.md](./components.md).

## Theme modes (light / dark)

One theme, two modes — `tokens.json` declares exactly `"themes": ["light", "dark"]` and one
`darkSelector: "[data-theme=\"dark\"]"` (`sdk/org/libs/css/src/tokens/tokens.json:5-6`), and the
generator emits both modes into the single `theme.css` (`generate-theme.mjs:91-101`). Every app
imports `@lmthing/css/theme`
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
- **THING wordmark is multi-color** — render with `CozyThingText`; it emits one `<span>` per
  letter, each carrying its own brand class (`cozy-text--brand-1` … `--brand-5` for t/h/i/n/g,
  with `lm` on the neutral class), never a single solid color
  (`sdk/org/libs/ui/src/elements/branding/cozy-text/index.tsx:9-37`). The five brand tokens are
  authored as exactly that — "THING letter 't' — yellow (sunflower)", … "letter 'g' — orchid"
  (`sdk/org/libs/css/src/tokens/tokens.json:31-35`).
- **Legacy `--lm-*` bridge (chat surface)** — the chat components still use `--lm-*` vars, but
  `sdk/org/libs/ui/src/chat/app/styles.css` aliases every `--lm-*` to a shared token
  (`--lm-bg: var(--background)` at `:28`, `--lm-accent: var(--agent)` at `:34`, and the matching
  `--color-lm-*` Tailwind aliases at `:78-89`), so they are theme-aware and pass the gate. The
  stylesheet states the contract: the palette is owned by `@lmthing/css/theme.css`, "this surface
  must NOT redeclare shared tokens — it only bridges the legacy `--lm-*` aliases … onto shared
  tokens so they inherit light/dark automatically" (`styles.css:20-26`).

  **On web only.** That bridge is a CSS file, and React Native never loads it. The native
  primitive layer rewrites any `var(--x)` to the Tamagui token `$x`
  (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#nativeSafeProps`), and there is no
  `lm-*` entry in the generated token module
  (`sdk/org/libs/css/src/tamagui/tokens.generated.ts`) — so `var(--lm-text)` resolves to a token
  that does not exist and the colour is dropped SILENTLY. No crash, no warning, just uncoloured
  text. So the older advice here — "`lm-*` is sanctioned; don't churn it" — held only while the
  chat surface was web-only. **In any component that also runs on native, use the shared token
  directly** (`$foreground`, `$muted-foreground`, `$agent`, …). The renderer every `display()`
  descriptor passes through has been moved onto shared tokens for exactly this reason
  (`sdk/org/libs/ui/src/chat/components/render-descriptor.tsx#renderDescriptor`), as have the chat
  helpers (`sdk/org/libs/ui/src/chat/app/common.tsx`) and the `ask()` form
  (`sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx`).

  The `--lm-*` names are still live for one thing: a space's `theme.json` retints them at runtime
  through `applyThemeTokens` (`sdk/org/libs/ui/src/theme/theme.ts#applyThemeTokens`), which the
  CLI's own `--web` DevTools preview uses. That mechanism is web-only and unrelated to the shipped
  SPA. The desktop-only panels (`app/tree.tsx`, `app/inspector.tsx`, `app/DevPanel.tsx`,
  `app/replay.tsx`) still use the aliases and are fine where they are, because they are not
  reachable on a phone.
- **Component styling pattern** — a component carries its own styling as `$`-token style PROPS on
  a Tamagui primitive; there is no per-component stylesheet
  (`sdk/org/libs/ui/src/elements/forms/button/index.tsx#Button`). `libs/css` no longer ships
  `src/elements` or `src/components` at all — what remains is the generated theme, the tokens, the
  animations and the preflight (`sdk/org/libs/css/src/theme.css`). The BEM `@apply` stylesheets this
  section used to describe were retired with the Tamagui migration; the catalog generator that
  parsed them (`sdk/org/libs/css/scripts/generate-components-catalog.mjs`) now has nothing to read,
  and `COMPONENTS.md` is a historical artefact rather than a live index.
  Inline Tailwind utilities are only for trivial one-off layout. Full detail →
  [components.md](./components.md).

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
