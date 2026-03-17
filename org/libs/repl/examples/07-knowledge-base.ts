/**
 * Example 7: Knowledge base Q&A
 *
 * A searchable knowledge base with semantic-ish search.
 * Demonstrates: text search, multi-step retrieval, checkpoints for structured output.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/07-knowledge-base.ts -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/07-knowledge-base.ts -m openai:gpt-4o-mini -d debug-run.xml
 */

// ── Knowledge base ──

interface Article {
  id: string
  title: string
  category: string
  content: string
  tags: string[]
}

const ARTICLES: Article[] = [
  {
    id: 'ts-generics',
    title: 'TypeScript Generics Guide',
    category: 'TypeScript',
    content: 'Generics allow you to create reusable components that work with multiple types. Use <T> syntax to declare type parameters. Constraints narrow what types are accepted: <T extends string>. Common patterns include generic functions, generic interfaces, and generic classes. The keyof operator works well with generics for type-safe property access.',
    tags: ['typescript', 'generics', 'types', 'advanced'],
  },
  {
    id: 'react-hooks',
    title: 'React Hooks Deep Dive',
    category: 'React',
    content: 'Hooks let you use state and lifecycle features in function components. useState manages local state. useEffect handles side effects and cleanup. useContext accesses context values. useMemo and useCallback optimize performance by memoizing values and functions. Custom hooks extract reusable logic.',
    tags: ['react', 'hooks', 'state', 'effects'],
  },
  {
    id: 'node-streams',
    title: 'Node.js Streams Explained',
    category: 'Node.js',
    content: 'Streams process data in chunks rather than loading everything into memory. Readable streams emit data events. Writable streams consume data. Transform streams modify data as it passes through. Piping connects streams together. Backpressure prevents fast producers from overwhelming slow consumers.',
    tags: ['nodejs', 'streams', 'performance', 'io'],
  },
  {
    id: 'css-grid',
    title: 'CSS Grid Layout',
    category: 'CSS',
    content: 'CSS Grid is a two-dimensional layout system. Define rows and columns with grid-template-rows/columns. Place items with grid-row/column or named areas. fr units distribute available space. minmax() sets size ranges. auto-fill and auto-fit create responsive grids without media queries.',
    tags: ['css', 'grid', 'layout', 'responsive'],
  },
  {
    id: 'git-rebase',
    title: 'Git Rebase vs Merge',
    category: 'Git',
    content: 'Merge creates a merge commit preserving branch history. Rebase replays commits on top of another branch for a linear history. Interactive rebase (rebase -i) lets you squash, edit, or reorder commits. Golden rule: never rebase public/shared branches. Use rebase for local cleanup before pushing.',
    tags: ['git', 'rebase', 'merge', 'workflow'],
  },
  {
    id: 'docker-compose',
    title: 'Docker Compose for Development',
    category: 'DevOps',
    content: 'Docker Compose defines multi-container applications in a YAML file. Services specify containers, images, ports, volumes, and environment variables. Volumes persist data between restarts. Networks isolate service communication. Use profiles to selectively start services. Health checks ensure dependencies are ready.',
    tags: ['docker', 'compose', 'containers', 'devops'],
  },
  {
    id: 'sql-joins',
    title: 'SQL Joins Explained',
    category: 'Database',
    content: 'INNER JOIN returns rows with matches in both tables. LEFT JOIN includes all left rows plus matching right rows. RIGHT JOIN is the reverse. FULL OUTER JOIN includes all rows from both. CROSS JOIN produces the Cartesian product. Self-joins link a table to itself. Use ON for join conditions, WHERE for filtering after the join.',
    tags: ['sql', 'joins', 'database', 'queries'],
  },
  {
    id: 'websocket-protocol',
    title: 'WebSocket Protocol',
    category: 'Networking',
    content: 'WebSocket provides full-duplex communication over a single TCP connection. The handshake upgrades from HTTP. Messages can be text or binary frames. Ping/pong frames maintain the connection. Close frames initiate graceful shutdown. Unlike HTTP, the server can push messages without a client request.',
    tags: ['websocket', 'networking', 'realtime', 'protocol'],
  },
]

// ── Exported functions ──

/** Search articles by keyword (matches title, content, and tags) */
export function search(query: string): Array<{ id: string; title: string; category: string; relevance: number }> {
  const terms = query.toLowerCase().split(/\s+/)
  return ARTICLES
    .map(article => {
      const text = `${article.title} ${article.content} ${article.tags.join(' ')}`.toLowerCase()
      const matches = terms.filter(t => text.includes(t)).length
      return { id: article.id, title: article.title, category: article.category, relevance: matches / terms.length }
    })
    .filter(r => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
}

/** Get full article content by ID */
export function getArticle(id: string): Article | null {
  return ARTICLES.find(a => a.id === id) ?? null
}

/** List all categories */
export function listCategories(): string[] {
  return [...new Set(ARTICLES.map(a => a.category))]
}

/** List articles in a category */
export function listByCategory(category: string): Array<{ id: string; title: string; tags: string[] }> {
  return ARTICLES
    .filter(a => a.category.toLowerCase() === category.toLowerCase())
    .map(a => ({ id: a.id, title: a.title, tags: a.tags }))
}

/** Get all unique tags */
export function listTags(): string[] {
  return [...new Set(ARTICLES.flatMap(a => a.tags))].sort()
}

/** Find articles by tag */
export function findByTag(tag: string): Array<{ id: string; title: string; category: string }> {
  return ARTICLES
    .filter(a => a.tags.includes(tag.toLowerCase()))
    .map(a => ({ id: a.id, title: a.title, category: a.category }))
}

// ── CLI config ──

export const replConfig = {
  instruct: `You are a knowledge base assistant. Help users find and understand technical articles. When answering a question:
1. Search for relevant articles
2. Read the full content of the most relevant ones
3. Synthesize an answer using the article content
Always cite which articles you used.`,
  functionSignatures: `
  search(query: string): Array<{ id, title, category, relevance }> — Search articles by keyword
  getArticle(id: string): Article | null — Get full article. Returns { id, title, category, content, tags }
  listCategories(): string[] — List all categories
  listByCategory(category: string): Array<{ id, title, tags }> — List articles in a category
  listTags(): string[] — Get all unique tags
  findByTag(tag: string): Array<{ id, title, category }> — Find articles by tag
  `,
  maxTurns: 10,
}
