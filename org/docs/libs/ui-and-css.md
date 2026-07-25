# @lmthing/ui + @lmthing/css

The shared frontend layer for **every** lmthing surface — the unified studio/chat/computer app (`sdk/org/apps/web`) and the product SPAs. Two packages, cleanly split:

- **`@lmthing/css`** — the design system: one token source of truth, the generated plain-CSS theme, per-component BEM stylesheets, and the build/lint scripts. No JS/JSX. `sdk/org/libs/css/package.json:2`.
- **`@lmthing/ui`** — React: unstyled-logic primitives ("elements"), cross-surface components, hooks, theme control, and the three surface bundles (chat/studio/computer). Each visual element imports its paired stylesheet from `@lmthing/css`. `sdk/org/libs/ui/package.json:2`.

The **rules** for using this system (never a raw color, stone-not-grey, brand-leads, the full-spectrum rotation) live in the design-system docs — see [../design-system/README.md](../design-system/README.md). This file documents **what the two packages expose and how the pipeline is wired**.

---

## `@lmthing/css` — the design system package

Pure CSS + Node build scripts. No runtime code. Entry points (`sdk/org/libs/css/package.json:6-16`):

| Export | Resolves to | Purpose |
|---|---|---|
| `@lmthing/css/theme` | `src/theme.css` | The generated token stylesheet (plain CSS) — imported **once** per app; pulls in `preflight.css`. |
| `@lmthing/css/animations` | `src/animations.css` | The keyframe layer — plain CSS. Imported once per app, from the app entry. |
| `@lmthing/css/preflight` | `src/preflight.css` | The base resets the primitives assume (`box-sizing`, `border: 0 solid`, …). Tailwind's own preflight, checked in with its variables resolved; imported by `theme.css` into `layer(base)`. |
| `@lmthing/css/tokens.json` | `src/tokens/tokens.json` | The single source of truth (raw token authoring). |
| `@lmthing/css/tokens.manifest.json` | `tokens.manifest.json` | Generated flat token index (name, cssVar, utility, light, dark, description). |
| `@lmthing/css/elements/*` | `src/elements/*` | Per-primitive BEM stylesheet. |
| `@lmthing/css/components/*` | `src/components/*` | Per-composite-component stylesheet. |

> Note: the `exports` map (`sdk/org/libs/css/package.json:14-15`) points `./elements/*` → `./src/elements/*` and `./components/*` → `./src/components/*`.

**`@lmthing/css` has no peer dependencies at all any more.** It required `tailwindcss ^4` until phase 4 of the Tamagui migration; every stylesheet it ships is now plain CSS, so it needs nothing to compile. (`tw-animate-css` had already gone earlier in the same plan: `theme.css` imported it and nothing used it, and it was not free — it declares its keyframes and custom properties at the top level, so Tailwind emitted them regardless.) A `bin` entry ships the token linter as `lmthing-lint-tokens` (`sdk/org/libs/css/package.json:17-19`).

### The token source: `tokens.json`

Everything derives from `src/tokens/tokens.json` (`sdk/org/libs/css/src/tokens/tokens.json:1`). Four top-level keys:

- **`$meta`** — name, `themes: ["light","dark"]`, `darkSelector: "[data-theme=\"dark\"]"` (`tokens.json:2-8`).
- **`theme`** — non-color scales: `radius-*` and `font-*` (`tokens.json:10-20`).
- **`spectrum`** — a generation spec: interpolate `steps: 50` stops from `brand-1` to `brand-5` (`tokens.json:22-28`).
- **`colors`** — the authored color tokens, each `{ name, group, light, dark, description }` (`tokens.json:30-88`). Groups: `brand`, `neutral`, `surface`, `intent`, `functional`, `status`, `state`, `sidebar`.

Key anchors: the five brand letters `brand-1..5` = `#f5c815 #f9a94a #f38358 #ed92a1 #d59ec8` (yellow→amber→coral→rose→orchid), identical in light and dark (`tokens.json:31-35`). `primary` (`:47`) and `ring` (`:61`) are both coral `#f38358` (brand-3), in both modes. Functional/status colors are saturated: `knowledge` sage, `agent` plum (`tokens.json:63,65`), `success` green, `warning` amber (`tokens.json:68,70`).

### The generator: `generate-theme.mjs`

`scripts/generate-theme.mjs` reads `tokens.json` and emits **two generated files — never hand-edit either** (`sdk/org/libs/css/scripts/generate-theme.mjs:6-8`):

1. **`src/theme.css`** — plain CSS: a cascade-layer declaration, the preflight import, and four generated sections (`generate-theme.mjs#css`, emitted at `:132`):
   - `@layer base, components, utilities;` + `@import "./preflight.css" layer(base);` — the layer is load-bearing, see [../design-system/tokens.md](../design-system/tokens.md).
   - `:root { … }` — the `--radius-*` / `--font-*` scales (`generate-theme.mjs:67`).
   - `:root { --color-<name>: var(--<name>); }` — one alias per color token (`generate-theme.mjs:68`). SPIKE A1 resolves every Tamagui `$color` against these, so they are not optional.
   - `:root { --<name>: <light>; }` and `[data-theme="dark"] { --<name>: <dark>; }` — the light values, then only the tokens whose `dark !== light` as overrides (`generate-theme.mjs:69-72`).
2. **`tokens.manifest.json`** — a flat, machine-readable index of scales + colors with `cssVar`, `utility`, light/dark, description (`generate-theme.mjs:134-158`).

**Spectrum interpolation** (`buildSpectrum`, `generate-theme.mjs:32-47`): the 50-stop ramp places the five brand anchors at indices 1, 14, 27, 40, 53 (spacing 13) and does a linear RGB lerp between consecutive anchors, rounded to hex. The result is appended to the color list as `spectrum-1..50` (same in light and dark, `generate-theme.mjs:54-63`) so both `--spectrum-N` and its `--color-spectrum-N` alias exist.

Run it with `pnpm --filter @lmthing/css generate` — which runs `generate-theme.mjs` **then** `generate-components-catalog.mjs`; it also runs on `prebuild` (`sdk/org/libs/css/package.json:32-33`).

### The catalog generator: `generate-components-catalog.mjs`

`scripts/generate-components-catalog.mjs` scans every `*.css` under `src/{elements,components}` (excluding `theme.css` — `generate-components-catalog.mjs:18-26,70`) and emits **`COMPONENTS.md`** — for each stylesheet, its class API grouped by BEM block (`.block` / `.block__element` / `.block--modifier`) and the design tokens it references (`generate-components-catalog.mjs:3-8,71-73`). It lets a human or LLM use the class API without reading the CSS. `COMPONENTS.md` is generated — do not hand-edit (`sdk/org/libs/css/COMPONENTS.md:3`).

### The gate: `lint-design-tokens.mjs`

`scripts/lint-design-tokens.mjs` is the **design-system adherence gate** — it fails (exit 1) on colors that bypass the token system (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:2-23`, `:120-131`):

- **`raw-hex`** — `#rgb/#rrggbb/#rrggbbaa` literals (`HEX_RE`, `lint-design-tokens.mjs:39,108`).
- **`stock-tailwind-color`** — stock family utilities like `bg-blue-500`, `text-gray-700`, with variant/opacity prefixes (`STOCK`/`STOCK_RE`, `lint-design-tokens.mjs:36-38,107`).
- **`raw-color-fn`** — `rgb()/hsl()` with literal channels (`FUNC_RE`, `lint-design-tokens.mjs:40,110-116`).

Allowed (not flagged): token-based `rgb/hsl(var(--…))`, and **achromatic** overlays/scrims/shadows (grey/black/white) with alpha < 1 (`funcAllowed`, `lint-design-tokens.mjs:44-57`). Escape hatches: `ds-lint-ok` on a line skips that line (`:99`); `ds-lint-file-ok` anywhere skips the whole file (`:96`) — for terminal ANSI palettes, syntax themes (`lint-design-tokens.mjs:17-20`). The token-definition files themselves (`theme.css`, `tokens.json`, `tokens.manifest.json`, anything under `scripts/`) are always exempt (`ALLOW_FILE`, `lint-design-tokens.mjs:30-34`).

Exposed as the `lmthing-lint-tokens` bin (`sdk/org/libs/css/package.json:17-19`) and run at the repo root via `pnpm lint:tokens` over eleven `src` roots (`package.json:14`) and in CI over ten of them (`.github/workflows/design-tokens.yml:39-43`). What is and is not gated → [../design-system/README.md](../design-system/README.md).

### The stylesheet convention

**There is no `@apply` and no Tailwind.** Phase 4 of the Tamagui migration expanded all 87 `@apply`
directives to plain CSS, resolved every `--tw-*` variable to a literal, and deleted both
`@import "tailwindcss"` entries. What survives is hand-written BEM using design tokens directly —
no `@reference`, no utility layer, no build-time Tailwind step. Example — the step card
(`sdk/org/libs/css/src/components/workflow/step-card/index.css:1-7`):

```css
.step-card {
  position: relative;
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
```

The element-level stylesheets are gone entirely: every primitive and element now carries its styling
as Tamagui `$`-token PROPS rather than a class, so `src/elements/` no longer exists under
`libs/css/src`. Only 12 component stylesheets remain (`find sdk/org/libs/css/src -name '*.css'`),
plus `theme.css` (vars only), `preflight.css` (Tailwind's 38 base rules, inlined with their variables
resolved) and `animations.css` (keyframes). A standing test asserts none of it comes back
(`sdk/org/libs/css/src/tailwind-free.test.ts:1`).

### CSS file tree

- **`src/elements/`** — **deleted.** The primitive/element stylesheets it held are gone; those
  elements carry `$`-token props instead of classes.
- **`src/components/`** — the 12 surviving composite stylesheets: `agent/builder`, `computer/ide-file-tree`,
  `markdown`, `presentation`, `setup-guide`, `shell`, `space`, and
  `workflow/{step-card,step-schema-editor,workflow-card,workflow-list}`
  (`find sdk/org/libs/css/src/components -name '*.css'`).
- **top level** — `theme.css` (generated, vars only), `preflight.css`, `animations.css`.

---

## `@lmthing/ui` — the React package

`type: module`, `sideEffects: false` (`sdk/org/libs/ui/package.json:4,29`). Entry points (`sdk/org/libs/ui/package.json:8-19`):

| Export | Resolves to | Contents |
|---|---|---|
| `@lmthing/ui` (`.`) | `src/index.ts` | Only re-exports `components/auth` (`src/index.ts:2`). |
| `@lmthing/ui/chat` | `src/chat/index.ts` | The chat surface public API. |
| `@lmthing/ui/chat/css` | `src/chat/app/styles.css` | Chat surface stylesheet — base/reset styles, scrollbars, the focus ring, the `--lm-*` token bridge and the safe-area classes. Also the repo's **second `@import "tailwindcss"` entry**; its keyframes and `.lm-prose` moved out to `@lmthing/css`. |
| `@lmthing/ui/studio` | `src/studio/index.ts` | The studio surface public API. |
| `@lmthing/ui/computer` | `src/computer/index.ts` | The computer surface public API. |
| `@lmthing/ui/components/*` | `src/components/*/index.ts` | Cross-surface components (only `auth` today). |
| `@lmthing/ui/elements/*` | `src/elements/*` | Primitives (deep-imported by path). |
| `@lmthing/ui/lib/*` | `src/lib/*` | `cn`, spectrum helpers, url/path helpers. |
| `@lmthing/ui/theme` | `src/theme/index.ts` | Theme control. |

Deps: `@lmthing/auth`, `@lmthing/core`, `@lmthing/css`, `marked`, `modern-screenshot`, `zustand` (`sdk/org/libs/ui/package.json:37-43`). React, all Radix primitives, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `@xterm/*`, `@monaco-editor/react`, `react-resizable-panels` are **peer** deps (`sdk/org/libs/ui/package.json:50-68`).

> **React ≥ 19 is required, not merely supported.** `@tamagui/core`, `@tamagui/web` and `@tamagui/animations-css` all declare `peerDependencies: { react: ">=19" }`, so the peer range here is `>=19` rather than `^18 || ^19`. This matters beyond version hygiene: `libs/ui` used to pin React 18 in its **devDependencies** while `apps/web`, `@lmthing/state` and `@lmthing/auth` were on 19, which put two copies of `@types/react` in the tree. That single pin is why `libs/ui` typechecked with `tsc --noCheck` and why its `app-sidebar`/`settings-dialog` suites could not render (a second React copy → "Invalid hook call"). Aligning it removed 133 `TS2786` errors from the `apps/web` typecheck, and was the precondition for **`libs/ui` now running a real `tsc --noEmit`** (`sdk/org/libs/ui/package.json:L27`) — see the note below. **`@lmthing/cli` deliberately stays on React 18** — it renders with `ink@5`, which is React 18 only; the two majors never meet in one bundle because `cli` is a Node CLI and `ui` is bundled by `apps/web`.

> **`libs/ui` runs a real `tsc --noEmit`** (`sdk/org/libs/ui/package.json:L27`). It
> previously ran `tsc --noEmit --noCheck` under the name `typecheck:syntax` — which, not being called
> `typecheck`, also meant turbo's workspace task skipped the package entirely. Two rules earned along
> the way:
>
> - **Probe a style prop before trusting it.** A prop Tamagui HONOURS that is undeclared is a missing
>   type; a prop it DROPS is a broken callsite, and the fixes are opposite. `wordBreak` emits no
>   atomic class at all, so it must go in `style`; `userSelect`, `backgroundImage`,
>   `WebkitBoxOrient`/`WebkitLineClamp`, the four per-corner radii, `focusWithinStyle`, `group` and
>   the `shadowColor`/`shadowOffset`/`shadowRadius` quartet all emit real atomics and are now declared
>   (`sdk/org/libs/ui/src/elements/primitives/_tamagui.tsx#BoxStyleProps`). `as` works on `Box`, which
>   maps it to a per-tag component, and is IGNORED on `Row`/`Col`, which are layout-only.
> - **Never fix an `import.meta.env` error with `"types": ["vite/client"]`.** Setting `types`
>   RESTRICTS which `@types` packages enter the program; doing this here silently suppressed ~111 real
>   errors while the count appeared to fall to 1. Verify any typecheck improvement with a
>   deliberately-wrong probe that MUST fail. The real cause was `@lmthing/auth` shipping SOURCE
>   (`main: "./src/index.ts"`), so it is typechecked inside every consumer's program, where its own
>   `src/vite-env.d.ts` is never loaded; it now reads env through one local accessor
>   (`sdk/org/libs/auth/src/AuthProvider.tsx:L19-L22`).

The primitive **style-prop types** are exported too — `LayoutStyleProps`, `BoxStyleProps`, `TextStyleProps`, `MarginStyleProps`, `ControlStyleProps`, `PseudoStyleProps` from `@lmthing/ui/elements/primitives` (`sdk/org/libs/ui/src/elements/primitives/index.ts:5`) — so a composite that spreads rest props onto a primitive can declare that in its own props interface instead of narrowing to `ComponentProps<'div'>` and casting.

### Elements (primitives)

`src/elements/` holds low-level React primitives; there is **no top-level barrel** — each is deep-imported by path (e.g. `@lmthing/ui/elements/forms/button`). Each visual element imports its paired stylesheet from `@lmthing/css` at the top of the module (e.g. `import '@lmthing/css/elements/forms/button/index.css'`, `src/elements/forms/button/index.tsx:1`) and composes classes with `cn`.

Directories (`src/elements/`):

- **`branding/`** — `cozy-text` (the multi-color THING wordmark, `CozyThingText`).
- **`content/`** — `avatar`, `badge`, `card`, `list-item`, `markdown` (renders trusted markdown via `marked`; imports `@lmthing/css/components/markdown/index.css`, `src/elements/content/markdown/index.tsx`), `panel`, `separator`, `terminal`.
- **`forms/`** — `button`, `input`, `select`, `textarea`.
- **`layouts/`** — `page`, `split-pane`, `stack`.
- **`nav/`** — `app-links`, `app-sidebar`, `breadcrumb`, `settings-dialog`, `sidebar`, `sidebar-footer`, `tab-bar`, `top-bar`.
- **`overlays/`** — `dialog`, `dropdown`, `sheet`.
- **`settings/`** — `account`, `backup`, `billing`, `env-vars`, `hooks`, `models`, `sessions`, `triggers` (settings-panel widgets composed from `forms/` + `typography/` primitives; these have **no** CSS dir of their own, `src/elements/settings/models/index.tsx`).
- **`typography/`** — `caption`, `code`, `heading`, `label`.

The `Button` (`src/elements/forms/button/index.tsx:11-46`) is representative: variants `primary | ghost | outline | destructive`, sizes `default | sm | lg | icon`, an `asChild` prop backed by Radix `Slot`, mapped to `btn` / `btn--<variant>` / `btn--<size>` classes.

### Components

`src/components/` currently holds one cross-surface component group, re-exported from the root entry (`src/index.ts:2`):

- **`components/auth`** — `GithubDeploymentStatus`, `GithubStars` (`sdk/org/libs/ui/src/components/auth/index.ts:1-2`), plus `login-screen` and `pin-gate` internals.

> `GithubLogin` was **deleted**. It imported `useGithub` from `@/lib/github/GithubContext`, a module
> that exists nowhere in either repo, so the component could not run — and because it was re-exported
> from `src/index.ts`, the `@lmthing/ui` ROOT entry did not resolve either. That entry is the import
> surface the component-editor templates and `@lmthing/core`'s typecheck overlay both point authors
> at, so this was a live breakage, not dormant dead code. Turning on a real `tsc` is what surfaced it.

### Hooks

`src/hooks/` — data hooks over the pod/VFS, grouped and barrelled per group (`src/hooks/<group>/index.ts`):

- **`agent/`** — `useAgent`, `useAgentList`, `useAgentConversation(s)`, `useAgentInstruct` (`src/hooks/agent/index.ts`).
- **`fs/`** — VFS hooks: `useFile`/`useFileWatch`, `useDir`/`useDirWatch`, `useGlob`/`useGlobRead`/`useGlobWatch`, `useFileConfig`, `useFileFrontmatter`, `useStreamWrite`/`useStreamAppend`, plus scoped `useProjectFS`/`useSpaceFS`/`useAppFS`.
- **`knowledge/`** — `useKnowledgeTree`/`useKnowledgeDir`/`useKnowledgeFile`/`useKnowledgeConfig`, `useKnowledgeFields`/`useFieldSchema`.
- **`project/`** — `useProject(s)`, `useProjectConfig`, `useProjectEnv`/`useProjectEnvList`, `useProjectSpaces`, `useApp`.
- **`space/`** — `useEnvFile`/`useEnvFileList`, `usePackageJson`.
- **`workflow/`** — `useWorkflowList`, `useTasklistList`.

### Lib

`src/lib/`:

- **`utils.ts`** — `cn(...inputs)` = `twMerge(clsx(inputs))`, the class-merge helper every element uses (`src/lib/utils.ts:4-6`).
- **`spectrum.ts`** — the full-spectrum rotation helpers: `spectrumVar(i)` → `var(--spectrum-N)` (1..50, cycles), `brandVar(i)` → `var(--brand-N)` (1..5), and stable-by-key `spectrumColor(key)` / `brandColor(key)` (djb2 hash) — for coloring avatars, sidebar sections, tabs. Never hand-pick a hex (`src/lib/spectrum.ts:1-46`).
- **`app-urls.ts`** — cross-surface links; the three surfaces are routes on one origin (`/studio`, `/chat`, `/computer`) (`src/lib/app-urls.ts:1-6`).
- **`space-path.ts`** — studio drill-down nav path helpers rooted at `/studio` (`src/lib/space-path.ts:1-8`).

### Theme control

`src/theme/theme.ts` is the runtime theme switch (re-exported from `@lmthing/ui/theme` and from `@lmthing/ui/chat`, `src/theme/index.ts:1`, `src/chat/index.ts:16`):

- **`applyTheme(name)`** — sets `data-theme` on `<html>` and persists to `localStorage['lm-theme']` (`theme.ts:19-27`).
- **`initTheme(fallback='light')`** — reads the stored choice (or fallback) and applies it (`theme.ts:29-38`).
- **`currentTheme()`** — reads the current `data-theme` (`theme.ts:12-15`).
- **`useTheme()`** — a React hook returning `[theme, setTheme, toggle]` (`theme.ts:53-64`).
- **`applyThemeTokens(tokens)`** — override individual `--lm-*` tokens at runtime (e.g. from a space's `theme.json`), also mirrored to `--color-lm-*` (`theme.ts:41-50`).
- Type `ThemeName = 'dark' | 'light' | (string & {})` (`theme.ts:9`).

This is how "one theme, two modes" is enforced at runtime. The token source declares exactly two themes and one selector — `"themes": ["light", "dark"]`, `"darkSelector": "[data-theme=\"dark\"]"` (`sdk/org/libs/css/src/tokens/tokens.json:5-6`) — the generator emits both into the single `theme.css`, and `applyTheme` here is what flips `data-theme="dark"` on `<html>`. The rule → [../design-system/README.md](../design-system/README.md).

### The three surface bundles

`@lmthing/ui` also ships the composed product surfaces:

- **`chat/`** (`src/chat/index.ts`) — `ChatShell`, `AgentChatPanel`, the REPL client (`useReplSession`, `ReplRpcClient`), agent block renderers (`DisplayBlock`, `AskBlock`, `VariablesBlock`, `ConsentCard`), the auth token helpers, the Ink-compat layer (`compat`), and the re-exported theme control.
- **`studio/`** (`src/studio/index.ts`) — barrels `shell`, `agent`, `component-editor`, `functions`, `workflow`, `knowledge`, `space`, `thing`, `integrations`. The shell exposes `StudioShell`/`StudioLayout`/`StudioSidebar`/`StudioProjectView`/`SettingsView`/… (`src/studio/shell/index.ts`).
- **`computer/`** (`src/computer/index.ts`) — the pod dashboard (`ComputerDashboard`, `StatusCard`, `MetricsCard`, `ProcessesPanel`, `AgentsPanel`, `LogsViewer`, `NetworkPanel`) and the IDE (`IdeLayout`, `IdeFileTree`, `IdeEditor`, `IdePreview`, `IdeTerminal`), plus `ConnectionBanner`/`BootProgress`.

These surfaces are documented per-product under [../chat/](../chat/README.md), [../studio/](../studio/README.md), and [../computer/](../computer/README.md).

---

## How an app wires it together

An app imports the two shared stylesheets **once** and then imports elements/components, whose modules pull in their own CSS. The unified web app does exactly this (`sdk/org/apps/web/src/index.css:1-7`):

1. `@import "@lmthing/css/theme.css"` — the token custom properties, the `--color-*` aliases and light/dark `:root`, plus `preflight.css` into `layer(base)`.
2. `@import "@lmthing/css/animations.css"` — the keyframe layer (`lm-*`, plus hand-written `animate-spin`/`animate-pulse`). Plain CSS, no Tailwind.
3. `import { Button } from '@lmthing/ui/elements/forms/button'` — the module side-imports `@lmthing/css/elements/forms/button/index.css`.
4. `applyTheme('dark')` from `@lmthing/ui/theme` flips `data-theme` on `<html>`.

**Why the keyframes are a separate import on the APP entry, not a route.** They used to live in
`sdk/org/libs/ui/src/chat/app/styles.css`, which is a second `@import "tailwindcss"` entry loaded by
the `/chat` route — so they were owned by a file scheduled for deletion, and declared in a route
module, which is only globally correct while the bundler emits a single CSS file. Component-scoped
stylesheets (`@lmthing/css/components/*`) are side-effect-imported by the component that needs them;
the keyframe layer has no single owning component, so it belongs on the entry.

---

## See also

- **[../design-system/README.md](../design-system/README.md)** — the canonical spec: the mandatory rules for using tokens/classes, the lint gate, and the change workflow. Also [../design-system/tokens.md](../design-system/tokens.md) (the token set) and the generated CSS-class catalog `sdk/org/libs/css/COMPONENTS.md`.
- [../libs/README.md](./README.md) — the shared-libraries index.
- [../chat/README.md](../chat/README.md) · [../studio/README.md](../studio/README.md) · [../computer/README.md](../computer/README.md) — the surfaces built from these components.
