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

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** `store/projects/` — the catalog dir (project-apps live here, incl. the ones the
 *  autonomous app-builder ships). */
export const APPS_DIR = path.resolve(__dirname, '..', 'projects')
/** `store/spaces/` — the catalog dir for standalone/installable spaces (incl. `integration-*`). */
export const SPACES_DIR = path.resolve(__dirname, '..', 'spaces')
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

// ── Catalog ENRICHMENT (S12) ────────────────────────────────────────────────
//
// A CatalogSpace carries a lifted summary of the space's producer/consumer
// surface so THING's `system-store` can fit-check an install from catalog data
// alone (does this space emit the events / expose the functions the user's
// automation needs?), without downloading it. Four lifted fields:
//   • events    — the union of every `events/*.ts` emitter def's `emits`.
//   • functions — the exported wrappers in `functions/*.ts` (name + summary + sig).
//   • agents    — each agent's frontmatter (slug + declared actions + triggers).
//   • inbound   — the public inbound path(s) of any `webhook` emitter def.
//
// `events` is the LOAD-BEARING one: it is produced by TRANSPILE+IMPORTING each
// def (trusted repo content, at CI build time) and running the shared emitter
// validator, so a MALFORMED def FAILS THE STORE BUILD LOUDLY. (Third-party
// submissions would instead need the pod's worker-isolated scanner —
// `server/emitter-manifests.ts` — never this in-process import.)

/** Lazily-loaded TypeScript compiler (a store devDependency; resolves from the
 *  workspace root). Used only to transpile emitter defs for import — kept lazy so
 *  the manifest can still regenerate if a caller has no `events/` dirs at all. */
let _ts
async function getTs() {
  if (!_ts) _ts = (await import('typescript')).default
  return _ts
}

/**
 * Vendored emitter-def validator — a faithful subset of the shared
 * `validateEmitterDef` in `sdk/org/libs/core/src/spaces/emitter-load.ts`. We
 * vendor rather than import from the built `@lmthing/core` because the store's
 * Docker build (`store/Dockerfile`) does NOT build core — only `@lmthing/store` —
 * so its dist is absent at store-build time. KEEP THIS IN LOCKSTEP with the core
 * validator: it enforces the discriminated `type`, the inline `emits` schema
 * (event-name + payload typeStrings), and the per-kind key checks. Throws
 * fail-loud (which fails the store build) on any malformed def.
 */
const EMITTER_TYPESTRINGS = new Set(['string', 'number', 'boolean', 'object', 'array', 'any'])
const EMITTER_EVENT_NAME_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$/
const EMITTER_PATH_RE = /^[A-Za-z0-9_-]+$/
const EMITTER_VERIFY_TYPES = new Set(['none', 'header-equals', 'body-token', 'hmac', 'ed25519', 'twilio'])

function validateEmitsVendored(where, raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${where}: \`emits\` must be an object mapping event name → { payload }`)
  }
  const entries = Object.entries(raw)
  if (entries.length === 0) throw new Error(`${where}: \`emits\` must declare at least one event`)
  const emits = {}
  for (const [event, spec] of entries) {
    if (!EMITTER_EVENT_NAME_RE.test(event)) {
      throw new Error(`${where}: invalid event name "${event}" (expected dot-separated lowercase segments)`)
    }
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new Error(`${where}: event "${event}" must be an object \`{ payload }\``)
    }
    const payload = spec.payload
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error(`${where}: event "${event}" needs a \`payload\` object (field → typeString)`)
    }
    const fields = {}
    for (const [field, type] of Object.entries(payload)) {
      // A trailing `?` marks the field optional; the base type must still be known.
      // (Lockstep with core spaces/emitter-load.ts validateEmits.)
      const base = typeof type === 'string' && type.endsWith('?') ? type.slice(0, -1) : type
      if (typeof type !== 'string' || !EMITTER_TYPESTRINGS.has(base)) {
        throw new Error(`${where}: event "${event}" field "${field}" has an invalid typeString ${JSON.stringify(type)}`)
      }
      fields[field] = type
    }
    emits[event] = { payload: fields }
  }
  return emits
}

function validateEmitterDefVendored(raw, where) {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`${where}: default export must be an emitter def object`)
  }
  if (typeof raw.emit !== 'function') throw new Error(`${where}: an emitter def needs an \`emit\` function`)
  const emits = validateEmitsVendored(where, raw.emits)

  if (raw.type === 'webhook') {
    if (typeof raw.path !== 'string' || !EMITTER_PATH_RE.test(raw.path)) {
      throw new Error(`${where}: a webhook emitter needs a URL-safe \`path\``)
    }
    const v = raw.verify
    if (v === null || typeof v !== 'object') throw new Error(`${where}: a webhook emitter needs a \`verify\` spec`)
    if (v.type === 'builtin') {
      if (v.provider !== 'slack' && v.provider !== 'github') {
        throw new Error(`${where}: \`verify: { type: 'builtin' }\` needs provider 'slack' | 'github'`)
      }
    } else if (!EMITTER_VERIFY_TYPES.has(v.type)) {
      throw new Error(`${where}: invalid \`verify\` spec ${JSON.stringify(v.type)}`)
    }
    return { type: 'webhook', path: raw.path, verify: v, emits }
  }
  if (raw.type === 'cron') {
    const hasEvery = typeof raw.every === 'string'
    const hasDaily = typeof raw.daily === 'string'
    if (hasEvery === hasDaily) throw new Error(`${where}: a cron emitter needs exactly one of \`every\` or \`daily\``)
    return { type: 'cron', emits }
  }
  if (raw.type === 'db') {
    const on = raw.on
    if (!on || typeof on.table !== 'string' || !on.table) throw new Error(`${where}: a db emitter needs \`on: { table, event }\``)
    if (on.event !== 'insert' && on.event !== 'update' && on.event !== 'remove') {
      throw new Error(`${where}: \`on.event\` must be 'insert' | 'update' | 'remove'`)
    }
    return { type: 'db', on: { table: on.table, event: on.event }, emits }
  }
  if (raw.type === 'internal') {
    const on = raw.on
    if (!on || typeof on.signal !== 'string' || !on.signal) throw new Error(`${where}: an internal emitter needs \`on: { signal }\``)
    return { type: 'internal', on: { signal: on.signal }, emits }
  }
  throw new Error(`${where}: \`type\` must be 'webhook' | 'cron' | 'db' | 'internal' (got ${JSON.stringify(raw.type)})`)
}

/**
 * Transpile+import one `events/*.ts` emitter def and return its VALIDATED shape.
 * Type-only imports (`import type … from '@lmthing/core'`) are elided by the TS
 * transpile, so the emitted module has no runtime dependency — it imports
 * cleanly in isolation. Throws (failing the build) on a transpile or validation
 * error. `emit` is never CALLED here (we only lift `type`/`emits`/`path`/etc.).
 */
async function loadEmitterDef(file) {
  const ts = await getTs()
  const src = await readFile(file, 'utf8')
  const { outputText } = ts.transpileModule(src, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
  })
  const tmp = path.join(tmpdir(), `emitter-${randomUUID()}.mjs`)
  await writeFile(tmp, outputText, 'utf8')
  try {
    const mod = await import(pathToFileURL(tmp).href)
    return validateEmitterDefVendored(mod.default, path.basename(file))
  } finally {
    await rm(tmp, { force: true })
  }
}

/**
 * Lift a space's `events/*.ts` defs into `{ events, inbound }`:
 *   • `events`  — union of every def's `emits` (event name → { payload }); a
 *     duplicate event name across two defs in the SAME space FAILS the build.
 *   • `inbound` — `[{ path, verify }]` for every `webhook` def (its public
 *     inbound path + the verify kind: the builtin provider or the spec `type`).
 * Empty (`{ events: {}, inbound: [] }`) when the space has no `events/` dir.
 */
async function loadSpaceEvents(spaceDir, spaceId) {
  const eventsDir = path.join(spaceDir, 'events')
  const names = await listNamesWithExt(eventsDir, '.ts')
  const events = {}
  const owner = {}
  const inbound = []
  for (const name of names) {
    const def = await loadEmitterDef(path.join(eventsDir, `${name}.ts`))
    for (const [event, spec] of Object.entries(def.emits)) {
      if (owner[event] !== undefined) {
        throw new Error(
          `[gen-apps-manifest] ${spaceId}: duplicate event "${event}" declared by "${owner[event]}" and "${name}" — event names must be unique within a space`,
        )
      }
      owner[event] = name
      events[event] = spec
    }
    if (def.type === 'webhook') {
      const verify = def.verify?.type === 'builtin' ? def.verify.provider : def.verify?.type
      inbound.push({ path: def.path, verify: String(verify) })
    }
  }
  inbound.sort((a, b) => a.path.localeCompare(b.path))
  return { events, inbound }
}

/**
 * Lift a space's `functions/*.ts` into `[{ name, summary?, signature? }]` via a
 * CHEAP static parse (no transpile): the exported function name, its declaration
 * line as the signature, and the first line of any leading block comment as the
 * summary. Best-effort — a function whose export we can't spot is simply skipped.
 */
async function loadSpaceFunctions(spaceDir) {
  const fnDir = path.join(spaceDir, 'functions')
  const names = await listNamesWithExt(fnDir, '.ts')
  const out = []
  for (const name of names) {
    const src = await readFile(path.join(fnDir, `${name}.ts`), 'utf8')
    const m = src.match(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)(\s*:\s*[^\{]+)?/)
    if (!m) {
      out.push({ name })
      continue
    }
    const fnName = m[1]
    const signature = `${fnName}(${m[2].replace(/\s+/g, ' ').trim()})${(m[3] ?? '').replace(/\s+/g, ' ').trimEnd()}`
    // Summary = first non-empty line of the block comment immediately above `export`.
    const before = src.slice(0, m.index)
    const comment = before.match(/\/\*\*([\s\S]*?)\*\/\s*$/)
    let summary
    if (comment) {
      const line = comment[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
        .find((l) => l.length > 0)
      if (line) summary = line
    }
    out.push({ name: fnName, ...(summary ? { summary } : {}), signature })
  }
  return out
}

/** Extract the YAML frontmatter block (between the first pair of `---` lines). */
function frontmatterBlock(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/)
  return m ? m[1] : ''
}

/**
 * Lift a space's `agents/<slug>/` into `[{ slug, actions?, triggers? }]` from
 * each agent's `instruct.md` (falling back to `charter.md`) frontmatter — a
 * light parse (no YAML dep): `actions` = the `- id: <x>` entries under
 * `actions:`; `triggers` = the trigger kinds listed under `triggers:`.
 */
async function loadSpaceAgents(spaceDir) {
  const agentsDir = path.join(spaceDir, 'agents')
  const slugs = await listDirNames(agentsDir)
  const out = []
  for (const slug of slugs) {
    const instruct = path.join(agentsDir, slug, 'instruct.md')
    const charter = path.join(agentsDir, slug, 'charter.md')
    const file = existsSync(instruct) ? instruct : existsSync(charter) ? charter : null
    if (!file) {
      out.push({ slug })
      continue
    }
    const fm = frontmatterBlock(await readFile(file, 'utf8'))
    const actions = []
    const triggers = []
    let section = null
    for (const rawLine of fm.split('\n')) {
      const line = rawLine.replace(/\t/g, '  ')
      const top = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/)
      if (top && !line.startsWith(' ') && !line.startsWith('-')) {
        section = top[1]
        continue
      }
      if (section === 'actions') {
        const id = line.match(/^\s*-\s*id:\s*([A-Za-z0-9_-]+)/)
        if (id) actions.push(id[1])
      } else if (section === 'triggers') {
        const t = line.match(/^\s*-\s*([A-Za-z0-9_]+)\s*:/)
        if (t) triggers.push(t[1])
      }
    }
    out.push({
      slug,
      ...(actions.length ? { actions } : {}),
      ...(triggers.length ? { triggers } : {}),
    })
  }
  return out
}

/**
 * Load one `store/spaces/<spaceId>/` into a `CatalogSpace` manifest entry, or `null` to skip
 * (no `lmthing` block in `package.json` — e.g. the plain demo workspaces `dog`, `google-sheets`).
 */
async function loadSpaceEntry(spaceDir, spaceId) {
  const pkg = await readJson(path.join(spaceDir, 'package.json'))
  const lmthing = pkg?.lmthing
  if (!lmthing) return null

  const [files, { events, inbound }, functions, agents] = await Promise.all([
    listAllFiles(spaceDir),
    loadSpaceEvents(spaceDir, spaceId),
    loadSpaceFunctions(spaceDir),
    loadSpaceAgents(spaceDir),
  ])

  return {
    id: spaceId,
    title: lmthing.title ?? humanizeId(spaceId),
    description: lmthing.description ?? pkg?.description ?? '',
    icon: lmthing.icon ?? null,
    tags: lmthing.tags ?? [],
    kind: lmthing.kind ?? null,
    settings: lmthing.settings ?? null,
    // Lifted producer/consumer surface (S12) — lets `system-store` fit-check an
    // install from catalog data alone. `events` is transpile-validated (a
    // malformed emitter def fails the store build).
    events,
    inbound,
    functions,
    agents,
    // Full download list — every space file, so a pod's install endpoint can fetch each
    // from `<store>/spaces/<id>/<relpath>` (no server-side catalog needed).
    files,
  }
}

/** Build the `{ apps: [...], spaces: [...] }` manifest object (no disk writes). */
export async function buildManifest(appsDir = APPS_DIR, spacesDir = SPACES_DIR) {
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

  const spaces = []
  if (await dirExists(spacesDir)) {
    const entries = await safeReaddir(spacesDir)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const space = await loadSpaceEntry(path.join(spacesDir, entry.name), entry.name)
      if (space) spaces.push(space)
    }
  }
  spaces.sort((a, b) => a.id.localeCompare(b.id))

  return { apps, spaces }
}

/** Build the manifest and write it to `manifestPath`. Returns the manifest object. */
export async function generateManifestFile(appsDir = APPS_DIR, manifestPath = MANIFEST_PATH, spacesDir = SPACES_DIR) {
  const manifest = await buildManifest(appsDir, spacesDir)
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

/**
 * Copy each app template (excluding `.data/`/`types/`/`node_modules/`) plus
 * `manifest.json` into `<distDir>/projects/` — the static assets nginx serves
 * alongside the SPA (`store/nginx.conf`), and what a pod's install endpoint
 * fetches in prod. Also copies each `store/spaces/<id>/` into `<distDir>/spaces/<id>/`
 * (same exclusions) — a pod's `/api/store/spaces/install` fetches a space's files from
 * `<store>/spaces/<id>/<relpath>` in prod, so those static assets must land under dist
 * `/spaces/` too.
 */
export async function copyAppsToDist(distDir, appsDir = APPS_DIR, manifestPath = MANIFEST_PATH, spacesDir = SPACES_DIR) {
  const destApps = path.join(distDir, 'projects')
  await mkdir(destApps, { recursive: true })
  if (existsSync(manifestPath)) {
    await cp(manifestPath, path.join(destApps, 'manifest.json'))
  }
  if (await dirExists(appsDir)) {
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

  if (await dirExists(spacesDir)) {
    const destSpaces = path.join(distDir, 'spaces')
    await mkdir(destSpaces, { recursive: true })
    const entries = await safeReaddir(spacesDir)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const srcSpaceDir = path.join(spacesDir, entry.name)
      const destSpaceDir = path.join(destSpaces, entry.name)
      await cp(srcSpaceDir, destSpaceDir, {
        recursive: true,
        filter: (src) => {
          const rel = path.relative(srcSpaceDir, src)
          if (rel === '') return true
          const top = rel.split(path.sep)[0]
          return !EXCLUDED_DIRS.has(top)
        },
      })
    }
  }
}

// CLI entry point — `node scripts/gen-apps-manifest.mjs` regenerates the manifest.
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = await generateManifestFile()
  const appCount = manifest.apps.length
  const spaceCount = manifest.spaces.length
  console.log(
    `[gen-apps-manifest] wrote ${path.relative(process.cwd(), MANIFEST_PATH)} ` +
      `(${appCount} app${appCount === 1 ? '' : 's'}, ${spaceCount} space${spaceCount === 1 ? '' : 's'})`,
  )
}
