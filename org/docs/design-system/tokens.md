# The Token System

The lmthing design system has **one source of truth**: `sdk/org/libs/css/src/tokens/tokens.json`. A generator turns it into a Tailwind v4 stylesheet (`theme.css`) and a flat machine-readable index (`tokens.manifest.json`). Every web surface — the `sdk/org` studio/chat/computer app and the product SPAs (`com`, `social`, `team`, `store`, `space`, `blog`, `casa`) — imports the generated `theme.css` and styles exclusively against these tokens. **Never write a raw color; never hand-edit `theme.css`.**

See [./README.md](./README.md) for the design-system overview and [./components.md](./components.md) for the BEM component layer that consumes these tokens.

---

## Pipeline: `tokens.json` → generator → `theme.css` + manifest

```
src/tokens/tokens.json   ── node scripts/generate-theme.mjs ──▶  src/theme.css          (Tailwind v4: @theme + @theme inline + :root + [data-theme="dark"])
   (edit here)                                               └▶  tokens.manifest.json   (flat: name, cssVar, utility, light, dark, description)
```

- **Edit only** `sdk/org/libs/css/src/tokens/tokens.json`, then regenerate. The `$meta.description` field states this rule inline: "Edit this file, then run `pnpm --filter @lmthing/css generate` … Do NOT hand-edit theme.css." (`sdk/org/libs/css/src/tokens/tokens.json:4`).
- **Regenerate:** `pnpm --filter @lmthing/css generate` runs `generate-theme.mjs` then `generate-components-catalog.mjs` (`sdk/org/libs/css/package.json` `scripts.generate`). It also runs automatically on `prebuild` (`scripts.prebuild`), so a fresh build always has current outputs.
- The generator reads the JSON, builds the interpolated spectrum, and writes both `src/theme.css` and `tokens.manifest.json`; it prints a summary line with the token/override counts (`sdk/org/libs/css/scripts/generate-theme.mjs:104-134`).

### What the generator emits into `theme.css`

`generate-theme.mjs` assembles the file from four token sections plus two `@import`s and a dark `@custom-variant` (`sdk/org/libs/css/scripts/generate-theme.mjs#css`):

1. `@import "tailwindcss";` and `@import "tw-animate-css";` (`theme.css:1-2`; both are `peerDependencies` in `package.json`).
2. `@custom-variant dark (&:is([data-theme="dark"] *));` — derived from `$meta.darkSelector` (`generate-theme.mjs:73,77`). This makes Tailwind's `dark:` variant key off the `data-theme` attribute rather than the OS preference.
3. `@theme { … }` — the non-color scales (`--radius-*`, `--font-*`), emitted verbatim from `tokens.theme` (`generate-theme.mjs:66,80-82`; output `theme.css:7-17`).
4. `@theme inline { … }` — one `--color-<name>: var(--<name>);` per color, which is what registers each color as a **Tailwind utility** (e.g. `bg-primary`, `text-agent`) (`generate-theme.mjs:67,86-88`; output `theme.css:21-121`).
5. `:root { … }` — the **light** values, one `--<name>: <light>;` per color (`generate-theme.mjs:68,92-94`; output `theme.css:124-224`).
6. `[data-theme="dark"] { … }` — **only** the colors whose `dark` value differs from `light` (`generate-theme.mjs:69-71,98-100`; output `theme.css:227-266`). Colors identical across modes (brand, spectrum, primary, ring) are simply not overridden.

Every generated block is bracketed by `/* Auto-generated … by generate-theme.mjs */` … `/* End Auto-generated … */` comments so the "do not hand-edit" boundary is visible in the file itself (`theme.css:6-18,20-121,123-224,226-266`).

### What the generator emits into `tokens.manifest.json`

A flat, LLM-/human-readable index with two arrays (`generate-theme.mjs:107-130`):

- `scales` — each `tokens.theme` entry as `{ name, cssVar, group, value }`, `group` being `font` (name starts with `font`) or `radius` (`generate-theme.mjs:114-119`).
- `colors` — each color (authored + spectrum) as `{ name, cssVar, utility, group, light, dark, description }`; `cssVar` is `--<name>`, `utility` is `--color-<name>` (`generate-theme.mjs:120-128`).

`$meta.note` records the contract: "Every token is a CSS custom property; colors are also exposed as Tailwind utilities via `--color-*` (e.g. `bg-primary`, `text-agent`)." (`generate-theme.mjs:112`).

---

## Token groups

Colors are authored as an ordered array in `tokens.json` `colors`, each `{ name, group, light, dark, description }` (`sdk/org/libs/css/src/tokens/tokens.json:30-88`). The `group` field is metadata carried into the manifest; it does not affect CSS output. The groups:

| Group | Tokens | Role |
|---|---|---|
| `brand` | `brand-1`…`brand-5` | THING wordmark letters t/h/i/n/g — yellow→amber→coral→rose→orchid; **identical in light & dark** (`tokens.json:31-35`) |
| `neutral` | `neutral-1`, `neutral` (alias) | Warm-stone neutral, "never cool grey" (`tokens.json:37-38`) |
| `surface` | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` | Page/card/menu surfaces + their text; faint warm tint (`tokens.json:40-45`) |
| `intent` | `primary`, `secondary`, `muted`, `accent` (+ each `-foreground`) | Action/CTA + supporting surfaces (`tokens.json:47-54`) |
| `functional` | `destructive`, `knowledge`, `agent` (+ `-foreground`) | Errors + the two data-stream colors (sage = knowledge, plum = agent) (`tokens.json:56-57,63-66`) |
| `status` | `success`, `warning` (+ `-foreground`) | Running/positive (green) and caution/booting (amber) (`tokens.json:68-71`) |
| `state` | `border`, `input`, `ring`, `hover`, `active`, `focus`, `disabled`, `disabled-foreground` | Borders, focus ring, and interaction overlays (`tokens.json:59-61,73-77`) |
| `sidebar` | `sidebar-background`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring`, `sidebar` (+ `-foreground`s) | Shell-chrome palette; coral active item (`tokens.json:79-87`) |
| `spectrum` | `spectrum-1`…`spectrum-50` | **Generated**, not authored — see below (`generate-theme.mjs:54-63`) |

Non-color scales live under `tokens.theme` (`tokens.json:10-20`):

- **Radii:** `radius-sm` `0.125rem`, `radius-md`/`radius` `0.375rem`, `radius-lg` `0.5rem`, `radius-xl` `0.75rem`, `radius-full` `9999px`.
- **Fonts:** `font-sans` and `font-display` = `TypeMates Cera Round Pro Bold, system-ui, sans-serif`; `font-mono` = `ui-monospace, monospace`.

### The spectrum ramp (generated)

The `spectrum` object in `tokens.json` is a *spec*, not a color list: `{ from: brand-1, to: brand-5, steps: 50, group: spectrum }` (`tokens.json:22-28`). `buildSpectrum` interpolates it (`generate-theme.mjs:32-47`):

- Anchors `brand-1..5` sit at ramp indices 1, 14, 27, 40, 53 (`spacing = 13`) (`generate-theme.mjs:33-35`).
- For each step `i` (1..50) it does a **linear RGB lerp** between the two bracketing anchors, rounding to a hex (`generate-theme.mjs:37-45`, using `hexToRgb`/`rgbToHex` `generate-theme.mjs:25-30`).
- Each `spectrum-<i>` gets the `spectrum` group and the same value for `light` and `dark` (`generate-theme.mjs:56-62`), so the rainbow is unchanged across modes.

Because anchors are placed at index 53 but only 50 steps are emitted, `spectrum-50` stops just short of pure `brand-5` (`#db9bbf` vs `#d59ec8`) (`theme.css:222`, `tokens.json:35`).

**Rotation helpers** (`sdk/org/libs/ui/src/lib/spectrum.ts`) spread the ramp across repeated UI (avatars, sidebar sections, tabs) so code never hand-picks a color:

- `spectrumVar(i)` → `var(--spectrum-N)`, N in 1..50, any integer index cycles (`spectrum.ts:18-21`).
- `brandVar(i)` → `var(--brand-N)`, N in 1..5, cycles (`spectrum.ts:24-27`).
- `spectrumColor(key)` / `brandColor(key)` → a **stable** color for a string key via a djb2-ish hash (`spectrum.ts:11-15,30-37`).

---

## Light / dark theming

**One theme, two modes.** Both modes are defined in the single generated `theme.css`: `:root` holds light, `[data-theme="dark"]` holds the dark overrides (`theme.css:124,227`). There is no second stylesheet and no app-level token redefinition.

- **Mode selector.** Dark mode is the presence of `data-theme="dark"` on `<html>`. `applyTheme(theme)` sets that attribute and persists the choice to `localStorage` under key `lm-theme` (`sdk/org/libs/ui/src/theme/theme.ts#STORAGE_KEY,19-27`). `initTheme(fallback='light')` reads the stored value and applies it on boot (`theme.ts:29-38`); `currentTheme()` reads the attribute (`theme.ts:14-17`); `useTheme()` is a React hook returning `[theme, setTheme, toggle]` (`theme.ts:51-61`). These are re-exported from `@lmthing/ui/theme` (`sdk/org/libs/ui/src/theme/index.ts:1`).
- **Which tokens change in dark.** Only colors with a distinct `dark` value are emitted into the dark block (`generate-theme.mjs:69-71`). Surfaces, text, functional/status colors, state overlays, and sidebar chrome all flip (`theme.css:227-266`). Notably **unchanged** across modes (absent from the dark block): all `brand-*`, all `spectrum-*`, and the coral anchors `primary`, `primary-foreground`, `ring`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-ring` — the CTA/ring stays coral in both modes.
- **Runtime token override.** A space may inject a custom token block at runtime via `applyThemeTokens(tokens)`, which sets `--lm-*` (and mirrored `--color-lm-*`) properties on `<html>` from a space's optional `theme.json` (`theme.ts:41-49`).

### `dark:` Tailwind variant

Because the generator emits `@custom-variant dark (&:is([data-theme="dark"] *))` (`theme.css:4`), Tailwind's `dark:` utilities activate under the `data-theme="dark"` ancestor — matching `applyTheme`'s attribute — rather than the OS `prefers-color-scheme`. In practice most styling relies on the token vars auto-swapping, so `dark:` overrides are rarely needed.

---

## The lint gate (`scripts/lint-design-tokens.mjs`)

Adherence is a **hard CI gate**: `pnpm lint:tokens` at repo root and the `@lmthing/css` `lint`/`lint:tokens` scripts (`sdk/org/libs/css/package.json`) run `scripts/lint-design-tokens.mjs`, which exits 1 on any bypass of the token system (`lint-design-tokens.mjs:120-131`). It scans `.css/.tsx/.ts/.jsx` (`lint-design-tokens.mjs:27`) and flags:

1. **Raw hex** — `#rgb`/`#rrggbb`/`#rrggbbaa` literals (`HEX_RE`, `lint-design-tokens.mjs:39,108`).
2. **Stock Tailwind color utilities** — `(bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder)-<family>-<50..950>` for any stock family (`slate`…`rose`), including variant/opacity prefixes (`STOCK`/`STOCK_RE`, `lint-design-tokens.mjs:36-38,107`).
3. **Raw color functions** — `rgb()/rgba()/hsl()/hsla()` that are neither token-based nor achromatic (`FUNC_RE` + `funcAllowed`, `lint-design-tokens.mjs:40,44-57,110-116`).

**Allowed (not flagged):**
- Token-based functions: any `rgb/hsl(var(--…))` (arg contains `var(`) (`lint-design-tokens.mjs:45`).
- **Achromatic** overlays/scrims/shadows with alpha < 1: `rgba(0,0,0,.5)`, `rgba(255,255,255,.7)`, or `hsl` with 0 saturation and alpha < 1 (`funcAllowed`, `lint-design-tokens.mjs:46-56`).

**Escape hatches** (`lint-design-tokens.mjs:96,99`):
- `ds-lint-ok` in a comment on the offending line skips that line.
- `ds-lint-file-ok` anywhere in a file skips the whole file (for terminal ANSI palettes, syntax-highlight themes, and other genuinely non-brand color sets).

**Files exempt by path** — the token definitions themselves: any `theme.css`, `tokens.json`, `tokens.manifest.json`, and anything under a `scripts/` dir (`ALLOW_FILE`, `lint-design-tokens.mjs:30-34`).

> CI runs the same linter as a hard gate: `.github/workflows/design-tokens.yml:39-43` invokes `node sdk/org/libs/css/scripts/lint-design-tokens.mjs` over the ten product `src` roots on every `pull_request` and on `push` to `main` (`design-tokens.yml:6-27`). Note it omits `org/src`, which the root `pnpm lint:tokens` does scan (`package.json:14`) — full breakdown of what is and is not gated → [README](./README.md).

---

## Quick reference

- **Use a color:** the CSS var `var(--foreground)` or its Tailwind utility `bg-primary` / `text-agent` / `border-border` (utilities exist because of the `@theme inline` `--color-*` block, `theme.css:21-121`).
- **Change a color:** edit `sdk/org/libs/css/src/tokens/tokens.json`, run `pnpm --filter @lmthing/css generate`, commit the regenerated `theme.css` + `tokens.manifest.json`. Never touch `theme.css` by hand.
- **Add a spectrum stop count / re-anchor:** edit `tokens.json` `spectrum` (`steps`, `from`, `to`) and regenerate; note the anchor spacing constant (`13`) in `buildSpectrum` assumes 5 anchors at 1/14/27/40/53 (`generate-theme.mjs:33-35`).
- **Full palette table with dark values:** the authored entries in `sdk/org/libs/css/src/tokens/tokens.json:30-88` (each with a `description` naming its semantic role), or the generated flat index `sdk/org/libs/css/tokens.manifest.json` — which adds the interpolated `spectrum-1..50` and each token's `cssVar` + `utility` (`generate-theme.mjs:120-128`).
