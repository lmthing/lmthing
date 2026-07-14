import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Locate sdk/org (the shared @lmthing/* libs). automation/app sits at
// <repo>/automation/app, sdk/org at <repo>/sdk/org — a fixed relative hop.
function findOrgRoot(start: string): string {
  let dir = path.resolve(start)
  while (true) {
    if (existsSync(path.join(dir, 'sdk', 'org', 'libs', 'css'))) return path.join(dir, 'sdk', 'org')
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`could not locate sdk/org from ${start}`)
    dir = parent
  }
}

const orgRoot = findOrgRoot(__dirname)
const PREFIX = '/scenario-dash'

export default defineConfig({
  // The dashboard is served under a path prefix on lmthing.cloud (no wildcard DNS
  // exists, so we reuse the lmthing.cloud hostname + cert via an HTTPRoute prefix).
  base: `${PREFIX}/`,
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lmthing/css': path.resolve(orgRoot, 'libs/css/src'),
    },
  },
  build: {
    outDir: 'ui-dist',
    emptyOutDir: true,
  },
  server: {
    // Vite serves the SPA; /api and /events are proxied to the Hono backend.
    proxy: {
      [`${PREFIX}/api`]: 'http://localhost:3000',
      [`${PREFIX}/events`]: 'http://localhost:3000',
    },
  },
})
