---
title: Frontend Stack
description: React 19, Vite 7, TanStack Router, Tailwind 4, and shared UI libraries
order: 1
---

# Frontend Stack

All lmthing product apps share the same frontend stack. Understanding these tools is essential for contributing to any app.

## Core Technologies

### React 19

- **Concurrent features**: `useTransition`, `useDeferredValue` for non-blocking UI updates
- **Server Components**: Not used — all apps are client-side SPAs
- **Key pattern**: Composition over inheritance, hooks for state and effects

### Vite 7

- **Build tool and dev server** with HMR (Hot Module Replacement)
- **Config**: Each app has `vite.config.ts` that extends shared config from `org/libs/utils/src/vite.mjs`
- **Alias resolution**: `@/` → `./src`, plus all `@lmthing/*` workspace packages
- **Plugins**: `@tailwindcss/vite` for Tailwind CSS processing

### TanStack Router

- **File-based routing** — routes derived from file structure in `src/routes/`
- **Type-safe** — route params and search params are fully typed
- **Layout routes**: `__root.tsx` for app shell, nested layouts for sections
- **Key files**: `src/routes/__root.tsx` (root layout), `src/routes/index.tsx` (home), `src/routeTree.gen.ts` (auto-generated)

### Tailwind CSS v4

- **Utility-first CSS** processed at build time by `@tailwindcss/vite`
- **Shared tokens**: Design tokens defined in `@lmthing/css`
- **No config file needed** — v4 uses CSS-based configuration
- **Pattern**: Use utility classes in JSX, extract to `@lmthing/ui` components for reuse

### Radix UI

- **Unstyled, accessible UI primitives** used by `@lmthing/ui`
- **Pattern**: Radix provides behavior (dropdown, dialog, tooltip), Tailwind provides styling
- **Key components**: Dialog, Dropdown Menu, Popover, Toast, Tooltip, Tabs

## Shared Libraries

### `@lmthing/ui` — UI Components

Shared component library built on Radix UI + Tailwind. Import from `@lmthing/ui`:

```tsx
import { Button, Dialog, Input, Card } from '@lmthing/ui'
```

### `@lmthing/css` — Shared Styles

Design tokens and global styles. Import the global stylesheet:

```tsx
import '@lmthing/css/global.css'
```

### `@lmthing/state` — Virtual File System

The VFS is the data layer for workspace management in the browser:

```tsx
import { useFile, useDir, useGlob, useDraft } from '@lmthing/state'

// Read a file
const [content, setContent] = useFile('agents/my-agent/instruct.md')

// List a directory
const files = useDir('agents/')

// Pattern matching
const configs = useGlob('**/config.json')

// Draft editing (optimistic updates with save/discard)
const { value, setValue, save, discard, isDirty } = useDraft('agents/my-agent/instruct.md')
```

Context hierarchy — each provider scopes the VFS to a subset:
```
AppProvider (root VFS) → StudioProvider (studio scope) → SpaceProvider (space scope)
```

### `@lmthing/auth` — Authentication

Cross-domain SSO client. Wrap app with `AuthProvider`, use `useAuth()`:

```tsx
import { AuthProvider, useAuth } from '@lmthing/auth'

const { isAuthenticated, isLoading, login, logout, username, session } = useAuth()
// session.accessToken is the JWT for calling cloud functions
```

## File Structure Convention

Every app follows the same structure:

```
app-name/
├── src/
│   ├── routes/          # TanStack Router file-based routes
│   │   ├── __root.tsx   # Root layout (AuthProvider, global providers)
│   │   └── index.tsx    # Home page
│   ├── components/      # App-specific components
│   ├── hooks/           # App-specific hooks
│   ├── lib/             # App-specific utilities
│   └── main.tsx         # Entry point
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Adding a New Page

1. Create a new file in `src/routes/` — the filename becomes the URL path
2. Export a `Route` using TanStack Router's `createFileRoute`:

```tsx
// src/routes/settings.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return <div>Settings</div>
}
```

3. Route is automatically registered in `routeTree.gen.ts`

## Adding a New Component

For **app-specific** components: create in `src/components/`
For **shared** components: add to `org/libs/ui/src/components/` and export from `@lmthing/ui`
