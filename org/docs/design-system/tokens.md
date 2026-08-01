# The Token System

The lmthing design system has **one source of truth**: `sdk/org/libs/css/src/tokens/tokens.json`. A generator turns it into a plain-CSS stylesheet (`theme.css`), a Tailwind registration file (`tailwind-theme.css`), and a flat machine-readable index (`tokens.manifest.json`). Every web surface — the `sdk/org` studio/chat/computer app and the product SPAs (`com`, `social`, `store`, `space`, `blog`, `casa`, `org`) — imports the generated `theme.css` and styles exclusively against these tokens. **Never write a raw color; never hand-edit `theme.css` or `tailwind-theme.css`.**

See [./README.md](./README.md) for the design-system overview and [./components.md](./components.md) for the BEM component layer that consumes these tokens.

---

## Pipeline: `tokens.json` → generator → `theme.css` + `tailwind-theme.css` + manifest

```
src/tokens/tokens.json   ── node scripts/generate-theme.mjs ──▶  src/theme.css           (plain CSS: preflight + :root scales + --color-* aliases + [data-theme="dark"])
   (edit here)                                               ├▶  src/tailwind-theme.css  (@theme inline — registers the colors WITH Tailwind)
                                                             └▶  tokens.manifest.json    (flat: name, cssVar, utility, light, dark, description)
```

- **Edit only** `sdk/org/libs/css/src/tokens/tokens.json`, then regenerate. The `$meta.description` field states this rule inline: "Edit this file, then run `pnpm --filter @lmthing/css generate` … Do NOT hand-edit theme.css." (`sdk/org/libs/css/src/tokens/tokens.json:4`).
- **Regenerate:** `pnpm --filter @lmthing/css generate` runs `generate-theme.mjs` then `generate-components-catalog.mjs` (`sdk/org/libs/css/package.json` `scripts.generate`). It also runs automatically on `prebuild` (`scripts.prebuild`), so a fresh build always has current outputs.
- The generator reads the JSON, builds the interpolated spectrum, and writes `src/theme.css`, `src/tailwind-theme.css` and `tokens.manifest.json`; it prints a summary line with the token/override counts (`sdk/org/libs/css/scripts/generate-theme.mjs`).

### What the generator emits into `theme.css`

`theme.css` is **plain CSS** — no Tailwind directives. It used to open with `@import "tailwindcss"` and express its tokens as `@theme` / `@theme inline` blocks; phase 4 of the Tamagui migration removed Tailwind from `apps/web` and the blocks became the `:root` rules they always compiled to (`sdk/org/libs/css/scripts/generate-theme.mjs#css`):

1. `@layer base, components, utilities;` then `@import "./preflight.css" layer(base);` — the base resets Tailwind used to inject. **The layer line is load-bearing:** importing preflight unlayered would make it stronger than an app's own `@layer base` block, so `border: 0 solid` would beat `* { border-color: var(--border) }`.
2. `:root { … }` — the non-color scales (`--radius-*`, `--font-*`), emitted verbatim from `tokens.theme`.
3. `:root { … }` — one `--color-<name>: var(--<name>);` alias per color. **SPIKE A1 depends on every one of these**: each Tamagui `$color` token resolves to `var(--color-<name>)`, so if they stop being emitted every colour in the app resolves to nothing.
4. `:root { … }` — the **light** values, one `--<name>: <light>;` per color.
5. `[data-theme="dark"] { … }` — **only** the colors whose `dark` value differs from `light`. Colors identical across modes (brand, spectrum, primary, ring) are simply not overridden.

Every generated block is bracketed by `/* Auto-generated … by generate-theme.mjs */` … `/* End Auto-generated … */` comments so the "do not hand-edit" boundary is visible in the file itself.

### What the generator emits into `tailwind-theme.css` — and why it is a separate file

`tailwind-theme.css` is one `@theme inline { … }` block with the same `--color-<name>: var(--<name>);` lines (`sdk/org/libs/css/scripts/generate-theme.mjs#tailwindTheme`). It exists because **`:root` and `@theme` are not interchangeable**: Tailwind emits a utility only for a colour it knows about, and it learns colours from `@theme`, never from `:root`. A plain custom property gives you `var(--color-primary)` and no `bg-primary`.

That distinction is not academic. When phase 4 converted these blocks to `:root`, the seven product SPAs — which were **not** migrated off Tailwind and carry ~330 token utilities between them (`text-muted-foreground`, `bg-primary`, `border-border`, …) — silently stopped receiving a single one. They shipped with the base reset and nothing else: content in source order, no layout, no colour.

`inline` is the load-bearing keyword. It makes the utility emit the token's **value** (`var(--primary)`) rather than a reference to Tailwind's own copy (`var(--color-primary)`), which is what keeps `bg-primary` following `data-theme="dark"` and a space's runtime `--lm-*` overrides instead of freezing at the light value — the same indirection SPIKE A1 relies on.

Only the product SPAs import it; `apps/web` has no Tailwind left to register with. See [product-spas](../product-spas/README.md#stylesheet-entry) for the exact import block.

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
| `logo` | `logo-1`…`logo-5` | **The wordmark's five hues, FROZEN** — t/h/i/n/g as yellow→amber→coral→rose→orchid, identical in light & dark. Read only by `elements/branding/cozy-text`; never use one as a general accent (`tokens.json:33-37`) |
| `brand` | `brand-1`…`brand-5` | Section/avatar **ramp anchors** — slate navy→teal→sage→taupe→muted plum. These follow the palette and **differ between light and dark** (`tokens.json:39-43`) |
| `neutral` | `neutral-1`, `neutral` (alias) | Cool neutral (`tokens.json:45-46`) |
| `surface` | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` | Page/card/menu surfaces + their text; cool and near-neutral (`tokens.json:48-53`) |
| `intent` | `primary`, `secondary`, `muted`, `accent` (+ each `-foreground`) | Action/CTA + supporting surfaces; CTA is slate teal (`tokens.json:55-62`) |
| `functional` | `destructive`, `knowledge`, `agent` (+ `-foreground`) | Errors + the two data-stream colors (muted green = knowledge, muted violet = agent) (`tokens.json:64-65,71-74`) |
| `status` | `success`, `warning` (+ `-foreground`) | Running/positive (green) and caution/booting (amber) (`tokens.json:76-79`) |
| `state` | `border`, `input`, `ring`, `hover`, `active`, `focus`, `disabled`, `disabled-foreground` | Borders, focus ring, and interaction overlays (`tokens.json:67-69,81-85`) |
| `sidebar` | `sidebar-background`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring`, `sidebar` (+ `-foreground`s) | Shell-chrome palette; slate-teal active item (`tokens.json:88-96`) |
| `spectrum` | `spectrum-1`…`spectrum-50` | **Generated**, not authored — see below (`generate-theme.mjs:54-63`) |

Non-color scales live under `tokens.theme` (`tokens.json:10-20`):

- **Radii:** `radius-sm` `0.125rem`, `radius-md`/`radius` `0.375rem`, `radius-lg` `0.5rem`, `radius-xl` `0.75rem`, `radius-full` `9999px`.
- **Fonts:** `font-sans` and `font-display` = `Manrope, system-ui, sans-serif`; `font-mono` = `JetBrains Mono, ui-monospace, monospace`; **`font-brand` = `TypeMates Cera Round Pro Bold, system-ui, sans-serif`** (`tokens.json:17-20`).

  `font-brand` is the WORDMARK's face and nothing else's. Cera Round Pro Bold used to be `font-sans`
  *and* `font-display`, so every paragraph, label and table cell on every surface rendered in a
  rounded display cut shipped in a single Bold weight — no weight hierarchy existed anywhere. Only
  `elements/branding/cozy-text` may reference `$brand`; a surface that names its own `fontFamily` on
  the mark overrides it (`sdk/org/libs/ui/src/elements/branding/cozy-text/index.tsx#CozyThingText`).

  All three faces are **self-hosted** from `/fonts/` — no Google Fonts request. `fonts.css` declares
  them and `theme.css` imports it, so every surface gets them; `scripts/sync-fonts.mjs` copies the
  files into each app's `public/fonts/` from `generate`/`prebuild`
  (`sdk/org/libs/css/src/fonts.css`, `sdk/org/libs/css/scripts/sync-fonts.mjs`). React Native cannot
  use `@font-face` at all and bundles the same files through `expo-font`
  (`sdk/org/apps/mobile/src/fonts.ts#FONT_ASSETS`).

### `lineHeight` is a number of PIXELS, never a CSS ratio

The generated ramp is px and paired key-for-key with `fontSizes` — `$sm` text is 14px with a 20px line box, `$base` is 16/24 (`sdk/org/libs/css/src/tamagui/tokens.generated.ts#lineHeights`), and the Tamagui font config carries both ramps verbatim (`sdk/org/libs/ui/src/theme/tamagui.config.ts:216-220`).

**A bare number is compiled as px, so a ratio is a bug in both targets.** Tamagui appends `px` to the number a style prop is given: the Tailwind `leading-relaxed` idiom `lineHeight={1.625}`, carried over from the pre-Tamagui CSS, emitted `line-height: 1.625px` — every wrapped line of a chat message was painted on top of the one before it, so the transcript read as a smear of overlapping glyphs on web. `lineHeight={1}` ("no extra leading") has the same defect and is only less visible because those call sites are single-line; write the font size instead (`lineHeight={16}` for `$base`). On native the same ratio is read as 1.625 **points** and `nativeSafeProps` drops anything under 4 (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#isNativeLineHeight`).

Both halves are enforced at the source: `sdk/org/libs/ui/src/elements/typography/lineHeight.test.tsx` fails on any `lineHeight` under 4 anywhere in `libs/ui/src`, and the native suites assert the mounted tree (`sdk/org/libs/ui/metro/suites/native-style-units.tsx`).

### The spectrum ramp (generated)

The `spectrum` object in `tokens.json` is a *spec*, not a color list: `{ from: brand-1, to: brand-5, steps: 50, group: spectrum }` (`tokens.json:22-28`). `buildSpectrum` interpolates it (`generate-theme.mjs:32-47`):

- Anchors `brand-1..5` sit at ramp indices 1, 14, 27, 40, 53 (`spacing = 13`) (`generate-theme.mjs:33-35`).
- For each step `i` (1..50) it does a **linear RGB lerp** between the two bracketing anchors, rounding to a hex (`generate-theme.mjs:37-45`, using `hexToRgb`/`rgbToHex` `generate-theme.mjs:25-30`).
- The ramp is cut **once per theme** — `buildSpectrum(spec, colorMap, 'light')` and again with `'dark'` — because `brand-1..5` now carry different values in each (`generate-theme.mjs#buildSpectrum`). It used to be cut from the light anchors only and copied to `dark`, which was correct only while the anchors were identical in both modes; leaving it that way would have painted the dark UI with the light ramp. `tamagui-tokens.mjs#buildSpectrum` does the same, and `token-parity.test.ts` fails byte-for-byte if the two ever disagree.

Because anchors are placed at index 53 but only 50 steps are emitted, `spectrum-50` stops just short of pure `brand-5` — `#6e575f` against the anchor's `#6b4f63` in light (`theme.css`, `tokens.json:43`).

**Rotation helpers** (`sdk/org/libs/ui/src/lib/spectrum.ts`) spread the ramp across repeated UI (avatars, sidebar sections, tabs) so code never hand-picks a color:

- `spectrumVar(i)` → `var(--spectrum-N)`, N in 1..50, any integer index cycles (`spectrum.ts:18-21`).
- `brandVar(i)` → `var(--brand-N)`, N in 1..5, cycles (`spectrum.ts:24-27`).
- `spectrumColor(key)` / `brandColor(key)` → a **stable** color for a string key via a djb2-ish hash (`spectrum.ts:11-15,30-37`).

---

## Light / dark theming

**One theme, two modes.** Both modes are defined in the single generated `theme.css`: `:root` holds light, `[data-theme="dark"]` holds the dark overrides (`theme.css:124,227`). There is no second stylesheet and no app-level token redefinition.

- **Mode selector.** Dark mode is the presence of `data-theme="dark"` on `<html>`. `applyTheme(theme)` sets that attribute and persists the choice to `localStorage` under key `lm-theme` (`sdk/org/libs/ui/src/theme/theme.ts#STORAGE_KEY,19-27`). `initTheme(fallback='light')` reads the stored value and applies it on boot (`theme.ts:29-38`); `currentTheme()` reads the attribute (`theme.ts:14-17`); `useTheme()` is a React hook returning `[theme, setTheme, toggle]` (`theme.ts:51-61`). These are re-exported from `@lmthing/ui/theme` (`sdk/org/libs/ui/src/theme/index.ts:1`).
- **Which tokens change in dark.** Only colors with a distinct `dark` value are emitted into the dark block (`generate-theme.mjs:69-71`). Surfaces, text, functional/status colors, state overlays, sidebar chrome, the CTA/ring (slate teal `#15505c` → `#6aa8b4`), **and now `brand-*` and all 50 `spectrum-*`** all flip. The dark block went from 37 overrides to 98 for exactly that reason. The only colors still identical in both modes are `logo-1..5` — the wordmark, deliberately frozen — and `scrim`.
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

**Comments are not scanned** (`lint-design-tokens.mjs#stripComments`). A comment cannot style anything, and the code most likely to *describe* `rgb()` or a hex in prose is usually the code that got colour handling right — `view/icons.tsx` resolves `$token` paints to a real `rgb()` because React Native SVG cannot parse tokens, and the JSDoc explaining why used to trip the gate on the word alone. Comments are blanked in place (positions preserved, so `file:line:col` stays accurate) and string literals are tracked, so a `//` inside a URL is not mistaken for a comment and a violation after it is still reported. `//` in a `.css` file is content, not a comment.

**Escape hatches**:
- `ds-lint-ok` in a comment on the offending line skips that line. Matched against the original line, since the marker itself lives in a comment.
- `ds-lint-file-ok` anywhere in a file skips the whole file (for terminal ANSI palettes, syntax-highlight themes, and other genuinely non-brand color sets).

The gate's own behaviour is tested end-to-end against fixtures, most of it guarding the *false-negative* direction — a comment-stripper that is slightly too eager stops reporting real violations and the gate goes quietly green (`sdk/org/libs/css/src/__tests__/lint-design-tokens.test.ts`).

**Files exempt by path** — the token definitions themselves: any `theme.css`, `tokens.json`, `tokens.manifest.json`, and anything under a `scripts/` dir (`ALLOW_FILE`, `lint-design-tokens.mjs:30-34`).

> CI runs the same linter as a hard gate: `.github/workflows/design-tokens.yml` invokes `node sdk/org/libs/css/scripts/lint-design-tokens.mjs` over the same roots as the root `pnpm lint:tokens`, on every `pull_request`, on `push` to `main`, and on demand via `workflow_dispatch`. Its path filter must list `sdk/org` as well as `sdk/org/**`, since a submodule bump changes only the bare gitlink path — full breakdown of what is and is not gated → [README](./README.md).

---

## Quick reference

- **Use a color:** the CSS var `var(--foreground)` or, in a product SPA, its Tailwind utility `bg-primary` / `text-agent` / `border-border` (the utilities exist only because `tailwind-theme.css` registers the colors with Tailwind — see above).
- **Change a color:** edit `sdk/org/libs/css/src/tokens/tokens.json`, run `pnpm --filter @lmthing/css generate`, commit the regenerated `theme.css` + `tailwind-theme.css` + `tokens.manifest.json`. Never touch the generated files by hand.
- **Add a spectrum stop count / re-anchor:** edit `tokens.json` `spectrum` (`steps`, `from`, `to`) and regenerate; note the anchor spacing constant (`13`) in `buildSpectrum` assumes 5 anchors at 1/14/27/40/53 (`generate-theme.mjs:33-35`).
- **Full palette table with dark values:** the authored entries in `sdk/org/libs/css/src/tokens/tokens.json:30-88` (each with a `description` naming its semantic role), or the generated flat index `sdk/org/libs/css/tokens.manifest.json` — which adds the interpolated `spectrum-1..50` and each token's `cssVar` + `utility` (`generate-theme.mjs:120-128`).
