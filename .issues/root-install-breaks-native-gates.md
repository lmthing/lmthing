# A root `pnpm install` silently breaks every native gate

**Found:** 2026-07-28, verifying phone-width work on the emulator. **Not a code bug — a workspace
layout problem.** Now DIAGNOSED and guarded, but not eliminated; the layout is still ambiguous, so
this stays open.

## Symptom

```bash
cd sdk/org && pnpm test:native
# UnableToResolveError: Unable to resolve module react from
#   sdk/org/libs/ui/src/elements/overlays/dialog/index.native.tsx:
#   react could not be found within the project or in these directories:
#     libs/ui/node_modules   ← it IS there
```

The Expo app fails the same way one module later (`marked`, from the markdown renderer) and shows it
as a redbox `Failed to compile` on the device. `@lmthing/mobile#typecheck` fails alongside it on a
Tamagui config type in `App.tsx` — a line nobody edited — and `pnpm typecheck` from `sdk/org` can
look GREEN while that happens, because turbo caches the task until something in `apps/mobile` changes.

## Cause (confirmed 2026-07-30)

**Two pnpm workspaces claim the same packages.** The root `pnpm-workspace.yaml` lists
`sdk/org/libs/*` and `sdk/org/apps/web` — it needs them to build the SPA images — while
`sdk/org/pnpm-workspace.yaml` lists `libs/*` and `apps/*`. So `sdk/org/libs/ui` is a member of both,
each workspace has its own lockfile and its own store, and whichever `pnpm install` ran last owns
the symlinks in that member's `node_modules`.

That is survivable only while both lockfiles agree, and nothing makes them. `libs/ui` asks for
`react: ^19.2.0` — a floating range each lockfile resolved independently, at different times:

| lockfile | resolved |
|---|---|
| `pnpm-lock.yaml` (root) | react 19.2.4, 19.2.14 |
| `sdk/org/pnpm-lock.yaml` | react 19.2.7, 19.2.17 |

After a root install, `libs/ui/node_modules/react` points into the **root** store at a version the
sdk/org tree was never built against. Metro then resolves two copies of React and reports the second
as missing.

Pinning both to one patch today would not fix it — the next `pnpm update` on either side diverges
again, and any floating dependency can do this, not just React.

## Guarded

`sdk/org/scripts/check-workspace-links.mjs` asserts that each member's `react`/`react-dom` resolves
INSIDE `sdk/org/node_modules` and at a version in sdk/org's own store. It runs as the precondition
of `test:native` — the loudest of the three symptoms — and prints the cause and the one-line fix
(`cd sdk/org && pnpm install`). Verified both directions: it passes on a healthy tree, and
re-pointing `libs/ui/node_modules/react` at the root store's 19.2.4 makes it fail with that path
named.

It deliberately does NOT repair anything. Which install is the right one depends on what you are
about to do — building an SPA image genuinely wants the root workspace — so it says so instead of
guessing.

## Still open — the real fix

One of these, none of them small:

- Remove `sdk/org/libs/*` from the ROOT workspace and give the root-context Dockerfiles another way
  to stage the libs. Structurally correct; touches every SPA image build.
- Make the two lockfiles share resolution (one catalog, exact pins for every shared singleton) so
  membership in both is harmless.
- Move the SPA builds into `sdk/org` so there is only one workspace over that tree.
