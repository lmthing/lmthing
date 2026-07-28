# A root `pnpm install` silently breaks every native gate

**Found:** 2026-07-28, verifying phone-width work on the emulator. **Not a code bug — an install
trap**, but one that costs an hour if you have not seen it, so it stays written down until the
layout stops being ambiguous.

## Symptom

```bash
cd sdk/org && pnpm test:native
# UnableToResolveError: Unable to resolve module react from
#   sdk/org/libs/ui/src/elements/overlays/dialog/index.native.tsx:
#   react could not be found within the project or in these directories:
#     libs/ui/node_modules   ← it IS there
```

The Expo app fails the same way, one module later (`marked`, from the markdown renderer), and shows
it as a redbox `Failed to compile` on the device. `@lmthing/mobile#typecheck` fails alongside it on
a Tamagui config type — and `pnpm typecheck` from `sdk/org` can look GREEN while it does, because
turbo caches that task until something in `apps/mobile` is edited.

## Cause

`libs/*` is a member of BOTH pnpm workspaces: the repo root globs `sdk/org/libs/*`, and `sdk/org`
has a workspace of its own (which is where `apps/mobile` lives — see
[`pnpm-workspace.yaml`](../pnpm-workspace.yaml)'s comment). So **whichever install ran last decides
where `libs/ui/node_modules/*` points**:

| last install | `libs/ui/node_modules/react` → | Metro |
|---|---|---|
| `cd sdk/org && pnpm install` | `sdk/org/node_modules/.pnpm/…` | resolves |
| `pnpm install` (repo root) | `<repo>/node_modules/.pnpm/…` | **fails** |

Metro watches `sdk/org`. A symlink into the OUTER store resolves to a real path outside everything
it watches, so it reports the package as missing — and helpfully lists the directory the symlink is
sitting in as a place it looked.

## Fix

```bash
cd sdk/org && pnpm install     # re-links libs/* into sdk/org's store
```

Both gates go green immediately. Nothing else is affected: the root install is what the SPA images
need, and re-running it is what breaks native again.

## What NOT to do

Adding the outer `node_modules` to Metro's `watchFolders` makes the resolution succeed and boots the
app to **"Can't find Tamagui configuration"** — two resolvable copies of `@tamagui/core`, the config
registered on one and read from the other. Adding it to `nodeModulesPaths` as well is the same fault
with more ways in. Tried both; the layout has to be single, not tolerated.

## The real fix, when someone wants it

Stop `libs/*` being a member of two workspaces. Either the root stops globbing `sdk/org/libs/*` (and
the SPA images take the libs from `sdk/org`'s install), or `apps/mobile` joins the root workspace —
which `pnpm-workspace.yaml` explains it deliberately does not, because a root-context Dockerfile
never stages it and `--frozen-lockfile` could then never be satisfied in both places.
