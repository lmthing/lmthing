// Loads every markdown doc as raw text at build time via Vite's glob import,
// and derives the route map + nav tree from the file structure (nothing is
// hardcoded — sections that don't exist on disk simply don't appear).

const modules = import.meta.glob('/docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Raw markdown keyed by its `/docs/...md` path. */
export const docFiles: Record<string, string> = modules

/**
 * Map a `/docs/...md` file path to its in-app route.
 *  - `/docs/README.md`                         → `/docs`   (docs root)
 *  - `/docs/SYNC.md`                            → `/sync`
 *  - `/docs/format/README.md`                  → `/format`
 *  - `/docs/format/project/api/README.md`      → `/format/project/api`
 *  - `/docs/format/space/events/webhook.md`    → `/format/space/events/webhook`
 */
export function docPathToRoute(docPath: string): string {
  let p = docPath.replace(/^\/docs\//, '').replace(/\.md$/, '')
  // A README is the index of its directory → drop the trailing segment.
  p = p.replace(/(^|\/)README$/i, '$1').replace(/\/+$/, '')
  if (p === '') return '/docs'
  return '/' + p.toLowerCase()
}

/** route → doc file path */
export const routeToDocPath: Record<string, string> = {}
for (const docPath of Object.keys(docFiles)) {
  routeToDocPath[docPathToRoute(docPath)] = docPath
}

/** Look up the raw markdown for a route (normalising trailing slashes). */
export function getDocForRoute(route: string): { docPath: string; content: string } | null {
  const normalised = route !== '/' ? route.replace(/\/+$/, '') : route
  const docPath = routeToDocPath[normalised] ?? routeToDocPath[normalised + '/']
  if (!docPath) return null
  return { docPath, content: docFiles[docPath] }
}

// ── Nav tree ────────────────────────────────────────────────────────────────

export interface NavNode {
  /** last path segment (raw), e.g. `runtime-globals`, `webhook` */
  key: string
  title: string
  /** route if a doc exists at exactly this node (its dir README or a leaf file) */
  route?: string
  children: NavNode[]
}

const SECTION_ORDER = [
  'docs',
  'format',
  'runtime-globals',
  'cli-api',
  'chat',
  'studio',
  'computer',
  'app',
  'cloud',
  'runtime',
  'libs',
  'devops',
  'design-system',
  'product-spas',
  'contributing',
  'sync',
  'architecture',
]

const TITLE_OVERRIDES: Record<string, string> = {
  docs: 'Overview',
  sync: 'Sync',
  architecture: 'Architecture',
  format: 'Format',
  'runtime-globals': 'Runtime globals',
  'cli-api': 'CLI & REST API',
  chat: 'Chat',
  studio: 'Studio',
  computer: 'Computer',
  app: 'Project app',
  cloud: 'Cloud',
  runtime: 'Runtime',
  libs: 'Libraries',
  devops: 'DevOps',
  'design-system': 'Design system',
  'product-spas': 'Product SPAs',
  contributing: 'Contributing',
  rest: 'REST API',
  api: 'API',
  db: 'Database',
  ui: 'UI',
}

export function humanize(key: string): string {
  if (TITLE_OVERRIDES[key]) return TITLE_OVERRIDES[key]
  // Preserve dotted filenames like `package.json`, `project.json`.
  if (key.includes('.')) return key
  const spaced = key.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function insert(root: NavNode, segments: string[], route: string) {
  let node = root
  for (const seg of segments) {
    let child = node.children.find((c) => c.key === seg)
    if (!child) {
      child = { key: seg, title: humanize(seg), children: [] }
      node.children.push(child)
    }
    node = child
  }
  node.route = route
}

function sortTree(node: NavNode, isRoot = false) {
  node.children.sort((a, b) => {
    if (isRoot) {
      const ia = SECTION_ORDER.indexOf(a.key)
      const ib = SECTION_ORDER.indexOf(b.key)
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      }
    }
    // Directories (nodes with children) before leaf files, then alphabetical.
    const da = a.children.length > 0 ? 0 : 1
    const db = b.children.length > 0 ? 0 : 1
    if (da !== db) return da - db
    return a.title.localeCompare(b.title)
  })
  node.children.forEach((c) => sortTree(c))
}

function buildNavTree(): NavNode {
  const root: NavNode = { key: '', title: '', children: [] }
  for (const [route, _docPath] of Object.entries(routeToDocPath)) {
    const segments = route.slice(1).split('/').filter(Boolean)
    if (segments.length === 0) continue
    insert(root, segments, route)
  }
  sortTree(root, true)
  return root
}

export const navTree: NavNode = buildNavTree()

/** Top-level sections that are real directories (have children) — for landing cards. */
export const topSections: NavNode[] = navTree.children.filter((n) => n.children.length > 0)

// ── Relative link resolution (markdown link → in-app route) ──────────────────

export interface ResolvedLink {
  route: string
  anchor?: string
}

/**
 * Resolve a relative markdown link found inside `currentDocPath` to an in-app
 * route. Returns null for external / unresolvable / pure-anchor links (the
 * caller renders those as plain anchors).
 */
export function resolveRelativeLink(currentDocPath: string, href: string): ResolvedLink | null {
  if (!href) return null
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('//')) return null
  if (href.startsWith('#')) return null

  const [rawPath, anchor] = href.split('#')
  if (!rawPath) return null

  // Directory of the current doc, e.g. "/docs/format/space/agents".
  const currentDir = currentDocPath.replace(/\/[^/]*$/, '')

  const base = rawPath.startsWith('/') ? '' : currentDir
  const combined = (base + '/' + rawPath).replace(/\/+/g, '/')

  // Normalise `.` and `..` segments.
  const out: string[] = []
  for (const seg of combined.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  let resolved = '/' + out.join('/')

  // Point bare directory links at their README.
  if (!/\.md$/i.test(resolved)) {
    resolved = resolved.replace(/\/+$/, '') + '/README.md'
  }

  const route = docPathToRoute(resolved)
  if (!routeToDocPath[route]) return null
  return { route, anchor: anchor || undefined }
}

/** Extract the first `# ` heading from markdown, for page/breadcrumb titles. */
export function docTitle(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m)
  return m ? m[1].replace(/`/g, '').trim() : fallback
}
