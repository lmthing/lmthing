#!/usr/bin/env node
/**
 * Build `src/client.jsx` into `lib/client.js` — the real, shipped `dsh.client` bundle shape
 * (Part A4, see dsh/PROGRESS.md). The REAL packages in this family (`@deepseek-ai/dsh-client-*`)
 * build with `tsdown`, whose output is not plain ESM/CJS but a specific "lazy CJS" envelope
 * `@deepseek-ai/dsh-client-modules` expects (confirmed by reading a real shipped bundle,
 * `@deepseek-ai/dsh-client-ui-skill/lib/client.js`, byte for byte):
 *
 *   window.__ModuleLoader__.load({
 *     id: "<package name>",
 *     factory: (require) => {
 *       var module = { exports: {} };
 *       var exports = module.exports;
 *       ...module body, using require('<specifier>') for every import...
 *       exports.name = name; exports.inject = inject; exports.apply = apply;
 *       return module.exports;
 *     }
 *   });
 *
 * `react`/`react/jsx-runtime`/`@deepseek-ai/cordis` are never bundled — they're part of the
 * "shell-seeded" implicit baseline `@deepseek-ai/dsh-client-modules` supplies to every plugin
 * bundle with no `dsh.client.external` declaration needed (confirmed in that package's own
 * README). esbuild's `format: 'cjs'` already emits `require(...)` calls for anything marked
 * `external` — the CJS output IS the factory body; this script only adds the envelope.
 */
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = join(here, '..')
const entry = join(pkgDir, 'src', 'client.jsx')
const outDir = join(pkgDir, 'lib')
const outFile = join(outDir, 'client.js')

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', '@deepseek-ai/cordis'],
  logLevel: 'silent',
})

const file = result.outputFiles?.[0]
if (!file) throw new Error('esbuild produced no output for client-space-components')

const body = file.text
const wrapped = `window.__ModuleLoader__.load({
  id: "@lmthing/dsh-client-space-components",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body.split('\n').map((line) => `    ${line}`).join('\n')}
    return module.exports;
  }
});
`

await mkdir(outDir, { recursive: true })
await writeFile(outFile, wrapped, 'utf8')
console.log(`wrote ${outFile} (${wrapped.length} bytes)`)
