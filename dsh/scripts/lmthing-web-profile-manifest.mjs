/**
 * The `lmthing-web` dsh profile's static shape — package.json/cordis.yml/pnpm-workspace.yaml —
 * factored out of `@lmthing/dsh-pod-server`'s `profile-bootstrap.js` so it has exactly one
 * definition, usable both as an ESM import (the pod-server's own local-dev fallback path, when no
 * image-baked profile is present) and as a standalone CLI (the Dockerfile's build-time step that
 * bakes this profile — `pnpm install` included — directly into the image; see
 * dsh/packages/pod-server/src/profile-bootstrap.js's doc comment and dsh/PROGRESS.md).
 *
 * The profile is 100% static — the same for every user and every boot — which is exactly why it's
 * safe to bake at image-build time instead of materializing it over the network on every pod
 * restart.
 *
 * CLI usage: `node lmthing-web-profile-manifest.mjs <dshRoot> <profileDir>`
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `@lmthing/dsh-*` import name -> its directory under `<dshRoot>/packages/`. Single source of
 * truth for both this manifest's `package.json.dependencies` and profile-bootstrap.js's runtime
 * re-link of a copied, image-baked profile (see that module's doc comment for why a plain
 * recursive copy alone isn't enough).
 */
export const LMTHING_WEB_PROFILE_DEPS = {
  '@lmthing/dsh-llm-mock': 'llm-mock',
  '@lmthing/dsh-space': 'space',
  '@lmthing/dsh-subagent-preset': 'subagent-preset',
  '@lmthing/dsh-client-space-components': 'client-space-components',
  '@lmthing/dsh-default-workspace': 'default-workspace',
  '@lmthing/dsh-client-brand': 'client-brand',
}

/**
 * Write the profile's package.json/cordis.yml/pnpm-workspace.yaml into `profileDir`. Does not run
 * `pnpm install` — callers (the CLI runner below, and profile-bootstrap.js's local-dev fallback)
 * do that themselves, since only one of them wants it to happen synchronously inline.
 * @param {object} opts
 * @param {string} opts.dshRoot - the dsh workspace root the `@lmthing/dsh-*` packages live under.
 * @param {string} opts.profileDir - where to write the profile's own tiny pnpm project.
 */
export async function writeLmthingWebProfileManifest({ dshRoot, profileDir }) {
  await mkdir(profileDir, { recursive: true })

  const linkDep = (pkg) => `link:${join(dshRoot, 'packages', pkg)}`
  await writeFile(
    join(profileDir, 'package.json'),
    JSON.stringify(
      {
        name: 'dsh-profile-lmthing-web',
        private: true,
        // Only @lmthing/* link deps — see profile-bootstrap.js's doc comment (Part A3): a direct
        // @deepseek-ai/dsh-web-app dep here creates a duplicate host-plane module identity and
        // every tool call fails with "Cannot read properties of undefined (reading 'prepare')".
        // @lmthing/dsh-llm-mock stays listed even in production: assemble-lmthing-profile.mjs
        // inserts it unconditionally (harmless, unused once agent-default-model is patched
        // elsewhere) — cheaper than teaching that script about a production mode it otherwise has
        // no reason to know about.
        dependencies: Object.fromEntries(
          Object.entries(LMTHING_WEB_PROFILE_DEPS).map(([name, dir]) => [name, linkDep(dir)]),
        ),
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
      },
      null,
      2,
    ),
    'utf8',
  )
  // A dsh profile is its own tiny pnpm project (isolated from the dsh/ repo workspace it links
  // back into) — mirrors exactly what `dsh profile new` itself generates (confirmed against the
  // hand-bootstrapped local dev profile). `hoisted` avoids pnpm's symlinked strict node_modules
  // inside what is, at runtime, an ephemeral generated directory, not a real package.
  await writeFile(
    join(profileDir, 'cordis.yml'),
    '# dsh profile root — patches (bundles, then cordis.patch.yml, then --patch overlays) do the real composing.\n[]\n',
    'utf8',
  )
  await writeFile(
    join(profileDir, 'pnpm-workspace.yaml'),
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n',
    'utf8',
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dshRoot, profileDir] = process.argv.slice(2)
  if (!dshRoot || !profileDir) {
    console.error('usage: node lmthing-web-profile-manifest.mjs <dshRoot> <profileDir>')
    process.exit(1)
  }
  await writeLmthingWebProfileManifest({ dshRoot, profileDir })
}
