import path from 'node:path'
import { createViteConfig } from '@lmthing/utils/vite'
import { generateManifestFile, copyAppsToDist } from './scripts/gen-apps-manifest.mjs'

/**
 * Regenerates `store/apps/manifest.json` from `store/apps/<appId>/` templates
 * on every build, then copies each template (+ the manifest) into the build
 * output (`<outDir>/apps/`) so nginx serves them as static assets — see
 * `store/scripts/gen-apps-manifest.mjs` for the full contract. Runs on
 * `buildStart`/`closeBundle` so `pnpm --filter @lmthing/store build` always
 * regenerates without a separate script-chaining step; tolerates an empty
 * `store/apps/` (emits `{ apps: [] }`).
 */
function appsManifestPlugin() {
  let outDir = path.resolve(__dirname, 'dist')
  return {
    name: 'lmthing-apps-manifest',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string }; root: string }) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    async buildStart() {
      await generateManifestFile()
    },
    async closeBundle() {
      await copyAppsToDist(outDir)
    },
  }
}

export default createViteConfig(__dirname, {
  plugins: [appsManifestPlugin()],
})
