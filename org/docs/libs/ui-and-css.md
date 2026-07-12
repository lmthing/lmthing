# @lmthing/ui + @lmthing/css

The shared frontend layer for **every** lmthing surface — the unified studio/chat/computer app (`sdk/org/apps/web`) and the product SPAs. Two packages, cleanly split:

- **`@lmthing/css`** — the design system: one token source of truth, the generated Tailwind v4 theme, per-component BEM stylesheets, and the build/lint scripts. No JS/JSX. `sdk/org/libs/css/package.json:2`.
- **`@lmthing/ui`** — React: unstyled-logic primitives ("elements"), cross-surface components, hooks, theme control, and the three surface bundles (chat/studio/computer). Each visual element imports its paired stylesheet from `@lmthing/css`. `sdk/org/libs/ui/package.json:2`.

The **rules** for using this system (never a raw color, stone-not-grey, brand-leads, the full-spectrum rotation) live in the design-system docs — see [../design-system/README.md](../design-system/README.md). This file documents **what the two packages expose and how the pipeline is wired**.

---

## `@lmthing/css` — the design system package

Pure CSS + Node build scripts. No runtime code. Entry points (`sdk/org/libs/css/package.json:8-14`):

| Export | Resolves to | Purpose |
|---|---|---|
| `@lmthing/css/theme` | `src/theme.css` | The generated Tailwind v4 theme — imported **once** per app. |
| `@lmthing/css/tokens.json` | `src/tokens/tokens.json` | The single source of truth (raw token authoring). |
| `@lmthing/css/tokens.manifest.json` | `tokens.manifest.json` | Generated flat token index (name, cssVar, utility, light, dark, description). |
| `@lmthing/css/elements/*` | `src/elements/*` | Per-primitive BEM stylesheet. |
| `@lmthing/css/components/*` | `src/components/*` | Per-composite-component stylesheet. |

> Note: the `exports` map (`sdk/org/libs/css/package.json:12-13`) points `./elements/*` → `./src/elements/*` and `./components/*` → `./src/components/*`.

Peer deps are `tailwindcss ^4` and `tw-animate-css` (`sdk/org/libs/css/package.json:33-36`) — the theme is a Tailwind v4 `@theme` stylesheet. A `bin` entry ships the token linter as `lmthing-lint-tokens` (`sdk/org/libs/css/package.json:16-18`).

### The token source: `tokens.json`

Everything derives from `src/tokens/tokens.json` (`sdk/org/libs/css/src/tokens/tokens.json:1`). Four top-level keys:

- **`$meta`** — name, `themes: ["light","dark"]`, `darkSelector: "[data-theme=\"dark\"]"` (`tokens.json:6-8`).
- **`theme`** — non-color scales: `radius-*` and `font-*` (`tokens.json:12-21`).
- **`spectrum`** — a generation spec: interpolate `steps: 50` stops from `brand-1` to `brand-5` (`tokens.json:24-30`).
- **`colors`** — the authored color tokens, each `{ name, group, light, dark, description }` (`tokens.json:33`+). Groups: `brand`, `neutral`, `surface`, `intent`, `functional`, `status`, `state`, `sidebar`.

Key anchors (`tokens.json:34-38`): the five brand letters `brand-1..5` = `#f5c815 #f9a94a #f38358 #ed92a1 #d59ec8` (yellow→amber→coral→rose→orchid), identical in light and dark. `primary`/`ring` = coral `#f38358` (brand-3). Functional colors `knowledge` (sage), `agent` (plum), `success` (green), `warning` (amber) are saturated.

### The generator: `generate-theme.mjs`

`scripts/generate-theme.mjs` reads `tokens.json` and emits **two generated files — never hand-edit either** (`sdk/org/libs/css/scripts/generate-theme.mjs:3-13`):

1. **`src/theme.css`** — a Tailwind v4 theme with four generated sections (`generate-theme.mjs:78-108`):
   - `@custom-variant dark (&:is([data-theme="dark"] *))` — the dark variant wired to the `$meta.darkSelector`.
   - `@theme { … }` — the `--radius-*` / `--font-*` scales.
   - `@theme inline { --color-<name>: var(--<name>); }` — exposes every color token as a **Tailwind color utility** (`bg-primary`, `text-agent`, `border-border`, …).
   - `:root { --<name>: <light>; }` and `[data-theme="dark"] { --<name>: <dark>; }` — the light values, then only the tokens whose `dark !== light` as overrides (`generate-theme.mjs:71-75`).
2. **`tokens.manifest.json`** — a flat, machine-readable index of scales + colors with `cssVar`, `utility`, light/dark, description (`generate-theme.mjs:111-137`).

**Spectrum interpolation** (`generate-theme.mjs:20-51`): the 50-stop ramp places the five brand anchors at indices 1, 14, 27, 40, 53 (spacing 13) and does a linear RGB lerp between consecutive anchors, rounded to hex. The result is appended to the color list as `spectrum-1..50` (same in light and dark) so `--spectrum-N` / `--color-spectrum-N` utilities exist.

Run it with `pnpm --filter @lmthing/css generate` — which runs `generate-theme.mjs` **then** `generate-components-catalog.mjs`; it also runs on `prebuild` (`sdk/org/libs/css/package.json:23-24`).

### The catalog generator: `generate-components-catalog.mjs`

`scripts/generate-components-catalog.mjs` scans every `*.css` under `src/{elements,components}` (excluding `theme.css`) and emits **`COMPONENTS.md`** — for each stylesheet, its class API grouped by BEM block (`.block` / `.block__element` / `.block--modifier`) and the design tokens it references (`generate-components-catalog.mjs:3-8, 76-78`). It lets a human or LLM use the class API without reading the CSS. `COMPONENTS.md` is generated — do not hand-edit (`sdk/org/libs/css/COMPONENTS.md:3`).

### The gate: `lint-design-tokens.mjs`

`scripts/lint-design-tokens.mjs` is the **design-system adherence gate** — it fails (exit 1) on colors that bypass the token system (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:3-24`):

- **`raw-hex`** — `#rgb/#rrggbb/#rrggbbaa` literals (`lint-design-tokens.mjs:44`).
- **`stock-tailwind-color`** — stock family utilities like `bg-blue-500`, `text-gray-700`, with variant/opacity prefixes (`lint-design-tokens.mjs:42-43`).
- **`raw-color-fn`** — `rgb()/hsl()` with literal channels (`lint-design-tokens.mjs:45`).

Allowed (not flagged): token-based `rgb/hsl(var(--…))`, and **achromatic** overlays/scrims/shadows (grey/black/white) with alpha < 1 (`funcAllowed`, `lint-design-tokens.mjs:49-62`). Escape hatches: `ds-lint-ok` on a line skips that line; `ds-lint-file-ok` anywhere skips the whole file (for terminal ANSI palettes, syntax themes) (`lint-design-tokens.mjs:16-19`). The token-definition files themselves (`theme.css`, `tokens.json`, `tokens.manifest.json`, anything under `scripts/`) are always exempt (`ALLOW_FILE`, `lint-design-tokens.mjs:29-33`).

Exposed as the `lmthing-lint-tokens` bin and run at the repo root via `pnpm lint:tokens` and in CI (`.github/workflows/design-tokens.yml`).

### The stylesheet convention

Element/component stylesheets are BEM and built on `@apply` with token utilities. Each opens with `@reference "…/theme.css"` so Tailwind resolves the utilities, then defines classes. Example — the button (`sdk/org/libs/css/src/elements/forms/button/index.css:1`):

```css
@reference "../../../theme.css";

.btn {
  @apply inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium
         transition-colors focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-ring focus-visible:ring-offset-2
         disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2;
}
.btn--primary { @apply bg-primary text-primary-foreground hover:bg-primary/90; }
.btn--destructive { @apply bg-destructive text-white hover:bg-destructive/90; }
```

### CSS file tree

- **`src/elements/`** — primitive stylesheets, mirrored by the UI elements: `branding/`, `content/` (avatar, badge, card, list-item, panel, separator, terminal), `forms/` (button, input, select, textarea), `layouts/` (page, split-pane, stack), `nav/` (app-links, app-sidebar, breadcrumb, settings-dialog, sidebar, tab-bar, top-bar), `overlays/` (dialog, dropdown, sheet), `typography/` (caption, code, heading, label).
- **`src/components/`** — composite/surface stylesheets: `agent/{builder,runtime}`, `auth`, `chat/chat-panel`, `component-editor`, `functions`, `knowledge`, `markdown`, `presentation`, `setup-guide`, `shell` (+ `shell/studio-shell`), `space`, `studio`, `thing/{thing-chat,thing-message,thing-panel}`, `workflow/{save-workflow-modal,step-card,step-config-panel,step-schema-editor,workflow-card,workflow-editor,workflow-list}` (`find css/src/components -name index.css`).

---

## `@lmthing/ui` — the React package

`type: module`, `sideEffects: false` (`sdk/org/libs/ui/package.json:4,29`). Entry points (`sdk/org/libs/ui/package.json:8-19`):

| Export | Resolves to | Contents |
|---|---|---|
| `@lmthing/ui` (`.`) | `src/index.ts` | Only re-exports `components/auth` (`src/index.ts:2`). |
| `@lmthing/ui/chat` | `src/chat/index.ts` | The chat surface public API. |
| `@lmthing/ui/chat/css` | `src/chat/app/styles.css` | Chat surface stylesheet. |
| `@lmthing/ui/studio` | `src/studio/index.ts` | The studio surface public API. |
| `@lmthing/ui/computer` | `src/computer/index.ts` | The computer surface public API. |
| `@lmthing/ui/components/*` | `src/components/*/index.ts` | Cross-surface components (only `auth` today). |
| `@lmthing/ui/elements/*` | `src/elements/*` | Primitives (deep-imported by path). |
| `@lmthing/ui/lib/*` | `src/lib/*` | `cn`, spectrum helpers, url/path helpers. |
| `@lmthing/ui/theme` | `src/theme/index.ts` | Theme control. |

Deps: `@lmthing/auth`, `@lmthing/core`, `@lmthing/css`, `marked`, `modern-screenshot`, `zustand` (`sdk/org/libs/ui/package.json:37-43`). React, all Radix primitives, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `@xterm/*`, `@monaco-editor/react`, `react-resizable-panels` are **peer** deps (`sdk/org/libs/ui/package.json:50-68`).

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

- **`components/auth`** — `GithubLogin`, `GithubDeploymentStatus`, `GithubStars` (`src/components/auth/index.ts:1-3`), plus `login-screen` and `pin-gate` internals.

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

This is how DESIGN.md rule 6 ("one theme, two modes") is enforced at runtime: dark mode = `data-theme="dark"` on `<html>`, set here.

### The three surface bundles

`@lmthing/ui` also ships the composed product surfaces:

- **`chat/`** (`src/chat/index.ts`) — `ChatShell`, `AgentChatPanel`, the REPL client (`useReplSession`, `ReplRpcClient`), agent block renderers (`DisplayBlock`, `AskBlock`, `VariablesBlock`, `ConsentCard`), the auth token helpers, the Ink-compat layer (`compat`), and the re-exported theme control.
- **`studio/`** (`src/studio/index.ts`) — barrels `shell`, `agent`, `component-editor`, `functions`, `workflow`, `knowledge`, `space`, `thing`, `integrations`. The shell exposes `StudioShell`/`StudioLayout`/`StudioSidebar`/`StudioProjectView`/`SettingsView`/… (`src/studio/shell/index.ts`).
- **`computer/`** (`src/computer/index.ts`) — the pod dashboard (`ComputerDashboard`, `StatusCard`, `MetricsCard`, `ProcessesPanel`, `AgentsPanel`, `LogsViewer`, `NetworkPanel`) and the IDE (`IdeLayout`, `IdeFileTree`, `IdeEditor`, `IdePreview`, `IdeTerminal`), plus `ConnectionBanner`/`BootProgress`.

These surfaces are documented per-product under [../chat/](../chat/README.md), [../studio/](../studio/README.md), and [../computer/](../computer/README.md).

---

## How an app wires it together

An app imports the theme **once** and then imports elements/components, whose modules pull in their own CSS. The unified web app does exactly this: `sdk/org/apps/web/src/index.css:1` is just `@import "@lmthing/css/theme.css";`.

1. `@import "@lmthing/css/theme.css"` — brings in Tailwind v4 + all token utilities + light/dark `:root`.
2. `import { Button } from '@lmthing/ui/elements/forms/button'` — the module side-imports `@lmthing/css/elements/forms/button/index.css`.
3. `applyTheme('dark')` from `@lmthing/ui/theme` flips `data-theme` on `<html>`.

---

## See also

- **[../design-system/README.md](../design-system/README.md)** — the mandatory rules for using tokens/classes (canonical spec: `sdk/org/libs/css/DESIGN.md`, catalog `sdk/org/libs/css/COMPONENTS.md`).
- [../libs/README.md](./README.md) — the shared-libraries index.
- [../chat/README.md](../chat/README.md) · [../studio/README.md](../studio/README.md) · [../computer/README.md](../computer/README.md) — the surfaces built from these components.
