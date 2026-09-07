#!/usr/bin/env node
/**
 * Build `src/client.jsx` into `lib/client.js` — same "lazy CJS" envelope every
 * `@deepseek-ai/dsh-client-*` bundle ships in. See client-space-components/scripts/build.mjs's
 * own doc comment for the full envelope rationale (confirmed byte-for-byte against a real shipped
 * bundle); this is a copy with the package id updated.
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
if (!file) throw new Error('esbuild produced no output for client-brand')

const body = file.text
const wrapped = `window.__ModuleLoader__.load({
  id: "@lmthing/dsh-client-brand",
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
