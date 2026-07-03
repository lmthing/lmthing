#!/usr/bin/env node
/**
 * Store catalog manifest generator (Phase 10 — store distribution).
 *
 * Scans `store/apps/<appId>/` (each a full project-app template per
 * `sdk/org/project-as-application-implementation.md` §0.6 — `package.json
 * database/ pages/ api/ hooks/ components/ lib/`, minus runtime `.data/`/
 * `types/`) and:
 *
 *  - writes `store/apps/manifest.json` = `{ apps: [{ id, title, description,
 *    icon, tables, pages, endpoints, hooks }] }` — the static browse index the
 *    public store SPA imports directly (no server call needed to browse).
 *  - copies each app template (excluding `.data/`/`types/`) plus the manifest
 *    itself into `<distDir>/apps/` so the built SPA serves them as static
 *    assets (nginx) — this is also how a pod's install endpoint fetches a
 *    published app's files in production (no server-side catalog needed).
 *
 * Tolerates a missing/empty `store/apps/` — emits `{ apps: [] }` rather than
 * throwing, so the store SPA always builds even before any app template
 * lands (mirrors `loadProjectApp`'s spaces-only tolerance in
 * `sdk/org/libs/cli/src/app/loader.ts`).
 *
 * Usage: `node scripts/gen-apps-manifest.mjs` regenerates the manifest only
 * (wired as the `prebuild` step in `package.json`). Wired into the Vite build
 * as a plugin too (`vite.config.ts`) so `pnpm --filter @lmthing/store build`
 * always regenerates + copies without a separate script-chaining step.
 */

import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** `store/apps/` — the catalog dir (§0.6). */
export const APPS_DIR = path.resolve(__dirname, '..', 'apps')
/** `store/apps/manifest.json` — the generated static browse index. */
export const MANIFEST_PATH = path.join(APPS_DIR, 'manifest.json')

/** Runtime/generated trees never copied into a distributed catalog entry. */
const EXCLUDED_DIRS = new Set(['.data', 'types'])

async function dirExists(p) {
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

/** `readdir` that returns `[]` (never throws) when `dir` is absent. */
async function safeReaddir(dir) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/** File basenames (extension stripped) under `dir` matching `ext` — sorted. */
async function listNamesWithExt(dir, ext) {
  const entries = await safeReaddir(dir)
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => e.name.slice(0, -ext.length))
    .sort()
}

/** Immediate subdirectory names under `dir` — sorted (e.g. `api/<name>/`). */
async function listDirNames(dir) {
  const entries = await safeReaddir(dir)
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/** File paths (`.tsx`/`.jsx`) recursively under `pages/`, relative to it — sorted. */
async function listPageFiles(dir, base = dir) {
  const entries = await safeReaddir(dir)
  const out = []
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listPageFiles(abs, base)))
    } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      out.push(path.relative(base, abs).split(path.sep).join('/'))
    }
  }
  return out.sort()
}

/** Load one `store/apps/<appId>/` template into a manifest entry, or `null` to skip it. */
async function loadAppEntry(appDir, appId) {
  const projectJsonPath = path.join(appDir, 'project.json')
  if (!existsSync(projectJsonPath)) return null

  let project
  try {
    project = JSON.parse(await readFile(projectJsonPath, 'utf8'))
  } catch (err) {
    console.warn(`[gen-apps-manifest] skipping "${appId}": invalid project.json (${err.message})`)
    return null
  }

  const [tables, pages, endpoints, hooks] = await Promise.all([
    listNamesWithExt(path.join(appDir, 'database'), '.json'),
    listPageFiles(path.join(appDir, 'pages')),
    listDirNames(path.join(appDir, 'api')),
    listNamesWithExt(path.join(appDir, 'hooks'), '.ts'),
  ])

  return {
    id: project.id ?? appId,
    title: project.title ?? appId,
    description: project.description ?? '',
    icon: project.icon ?? null,
    tables,
    pages,
    endpoints,
    hooks,
  }
}

/** Build the `{ apps: [...] }` manifest object from `appsDir` (no disk writes). */
export async function buildManifest(appsDir = APPS_DIR) {
  const apps = []
  if (await dirExists(appsDir)) {
    const entries = await safeReaddir(appsDir)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue // skips manifest.json (a file), stray dotfiles, etc.
      const app = await loadAppEntry(path.join(appsDir, entry.name), entry.name)
      if (app) apps.push(app)
    }
  }
  apps.sort((a, b) => a.id.localeCompare(b.id))
  return { apps }
}

/** Build the manifest and write it to `manifestPath`. Returns the manifest object. */
export async function generateManifestFile(appsDir = APPS_DIR, manifestPath = MANIFEST_PATH) {
  const manifest = await buildManifest(appsDir)
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

/**
 * Copy each app template (excluding `.data/`/`types/`) plus `manifest.json`
 * into `<distDir>/apps/` — the static assets nginx serves alongside the SPA
 * (`store/nginx.conf`), and what a pod's install endpoint fetches in prod.
 */
export async function copyAppsToDist(distDir, appsDir = APPS_DIR, manifestPath = MANIFEST_PATH) {
  const destApps = path.join(distDir, 'apps')
  await mkdir(destApps, { recursive: true })
  if (existsSync(manifestPath)) {
    await cp(manifestPath, path.join(destApps, 'manifest.json'))
  }
  if (!(await dirExists(appsDir))) return
  const entries = await safeReaddir(appsDir)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const srcAppDir = path.join(appsDir, entry.name)
    const destAppDir = path.join(destApps, entry.name)
    await cp(srcAppDir, destAppDir, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(srcAppDir, src)
        if (rel === '') return true
        const top = rel.split(path.sep)[0]
        return !EXCLUDED_DIRS.has(top)
      },
    })
  }
}

// CLI entry point — `node scripts/gen-apps-manifest.mjs` regenerates the manifest.
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = await generateManifestFile()
  const count = manifest.apps.length
  console.log(`[gen-apps-manifest] wrote ${path.relative(process.cwd(), MANIFEST_PATH)} (${count} app${count === 1 ? '' : 's'})`)
}
