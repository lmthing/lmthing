#!/usr/bin/env node
/**
 * Store catalog manifest generator (Phase 10 — store distribution).
 *
 * Scans `store/projects/<appId>/` (each a full project-app template per
 * `sdk/org/project-as-application-implementation.md` §0.6 — `package.json
 * database/ pages/ api/ hooks/ components/ lib/`, minus runtime `.data/`/
 * `types/`) and:
 *
 *  - writes `store/projects/manifest.json` = `{ apps: [{ id, title, description,
 *    icon, tables, pages, endpoints, hooks, files }] }` — the static browse index
 *    the public store SPA imports directly (no server call needed to browse).
 *  - copies each app template (excluding `.data/`/`types/`) plus the manifest
 *    itself into `<distDir>/projects/` so the built SPA serves them as static
 *    assets (nginx) — this is also how a pod's install endpoint fetches a
 *    published app's files in production (no server-side catalog needed).
 *
 * Tolerates a missing/empty `store/projects/` — emits `{ apps: [] }` rather than
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

/** `store/projects/` — the catalog dir (project-apps live here, incl. the ones the
 *  autonomous app-builder ships). */
export const APPS_DIR = path.resolve(__dirname, '..', 'projects')
/** `store/projects/manifest.json` — the generated static browse index. */
export const MANIFEST_PATH = path.join(APPS_DIR, 'manifest.json')

/** Runtime/generated/dependency trees never copied into a distributed catalog entry. */
const EXCLUDED_DIRS = new Set(['.data', 'types', 'node_modules'])

/** Title-case a slug id for a fallback display title (`personal-feed` → `Personal Feed`). */
function humanizeId(id) {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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

/**
 * ALL file paths under an app template, relative to it (`/`-joined, sorted),
 * excluding the runtime/generated/dependency dirs. This is the download list a
 * pod's install endpoint uses to fetch every file of the app from the store's
 * public path (`lmthing.store/projects/<appId>/<relpath>`).
 */
async function listAllFiles(dir, base = dir) {
  const entries = await safeReaddir(dir)
  const out = []
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listAllFiles(abs, base)))
    } else if (entry.isFile()) {
      out.push(path.relative(base, abs).split(path.sep).join('/'))
    }
  }
  return out.sort()
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

/** Read + parse a JSON file, or `null` if it's absent/invalid. */
async function readJson(p) {
  if (!existsSync(p)) return null
  try {
    return JSON.parse(await readFile(p, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Load one `store/projects/<appId>/` template into a manifest entry, or `null` to skip.
 * Metadata comes from `project.json` when present (hand-authored catalog apps like
 * `demo-feed`); otherwise it's derived from `package.json` (the app-builder ships apps
 * with a `package.json` name/description but no `project.json`). A dir that is neither an
 * app (no database/pages/api/hooks) nor carries either manifest is skipped.
 */
async function loadAppEntry(appDir, appId) {
  const project = await readJson(path.join(appDir, 'project.json'))
  const pkg = project ? null : await readJson(path.join(appDir, 'package.json'))

  const [tables, pages, endpoints, hooks, files] = await Promise.all([
    listNamesWithExt(path.join(appDir, 'database'), '.json'),
    listPageFiles(path.join(appDir, 'pages')),
    listDirNames(path.join(appDir, 'api')),
    listNamesWithExt(path.join(appDir, 'hooks'), '.ts'),
    listAllFiles(appDir),
  ])

  const looksLikeApp = tables.length + pages.length + endpoints.length + hooks.length > 0
  if (!project && !pkg) return null
  if (!project && !looksLikeApp) return null // a plain package that isn't a project-app

  return {
    id: project?.id ?? appId,
    title: project?.title ?? humanizeId(appId),
    description: project?.description ?? pkg?.description ?? '',
    icon: project?.icon ?? null,
    tables,
    pages,
    endpoints,
    hooks,
    // Full download list — every template file, so a pod's install endpoint can fetch
    // each from `<store>/projects/<id>/<relpath>` (no server-side catalog needed).
    files,
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
 * Copy each app template (excluding `.data/`/`types/`/`node_modules/`) plus
 * `manifest.json` into `<distDir>/projects/` — the static assets nginx serves
 * alongside the SPA (`store/nginx.conf`), and what a pod's install endpoint
 * fetches in prod.
 */
export async function copyAppsToDist(distDir, appsDir = APPS_DIR, manifestPath = MANIFEST_PATH) {
  const destApps = path.join(distDir, 'projects')
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
