// src/lib/fs/paths.ts

/**
 * Path builders for the pod-backed FS. AppFS key prefixes are
 * `projectId/spaceId/...` (no username segment — the pod is per-user).
 *
 * Scoped FS classes strip their prefix before delivering paths, so the builders
 * below are grouped by which scope they're used from:
 *   - App scope (AppFS): full paths including the projectId.
 *   - Project scope (ProjectFS — prefix `projectId/` already stripped).
 *   - Space scope (SpaceFS — prefix `projectId/spaceId/` stripped).
 */
export const P = {
  // ── App level (AppFS) ─────────────────────────────────────────────
  project: (projectId: string): string => `${projectId}`,

  projectSpace: (projectId: string, spaceId: string): string =>
    `${projectId}/${spaceId}`,

  // ── Project level (ProjectFS — prefix already stripped) ───────────
  projectConfig: 'lmthing.json',

  projectEnv: (suffix?: string): string => (suffix ? `.env.${suffix}` : '.env'),

  space: (spaceId: string): string => spaceId,

  // ── Space level (SpaceFS — prefix already stripped) ───────────────
  packageJson: 'package.json',

  agent: (id: string): string => `agents/${id}`,

  instruct: (id: string): string => `agents/${id}/instruct.md`,

  conversations: (id: string): string => `agents/${id}/conversations`,

  conversation: (id: string, cid: string): string =>
    `agents/${id}/conversations/${cid}.json`,

  // ── Tasklist paths ────────────────────────────────────────────────
  tasklistDir: (name: string): string => `tasklists/${name}`,

  tasklistIndex: (name: string): string => `tasklists/${name}/index.md`,

  tasklistTask: (name: string, order: number, id: string): string =>
    `tasklists/${name}/${String(order).padStart(2, '0')}-${id}.md`,

  // ── Function paths ────────────────────────────────────────────────
  functionFile: (name: string): string => `functions/${name}.ts`,

  // ── Component paths ───────────────────────────────────────────────
  viewComponent: (name: string): string => `components/view/${name}.tsx`,

  formComponent: (name: string): string => `components/form/${name}.tsx`,

  // ── Knowledge paths ───────────────────────────────────────────────
  knowledgeDir: (dir: string): string => `knowledge/${dir}`,

  knowledgeDomainIndex: (domain: string): `knowledge/${string}/index.md` =>
    `knowledge/${domain}/index.md`,

  knowledgeFieldDir: (domain: string, field: string): string =>
    `knowledge/${domain}/${field}`,

  knowledgeFieldIndex: (domain: string, field: string): string =>
    `knowledge/${domain}/${field}/index.md`,

  knowledgeOption: (domain: string, field: string, slug: string): string =>
    `knowledge/${domain}/${field}/${slug}.md`,

  // ── Glob patterns ─────────────────────────────────────────────────
  globs: {
    // App-scope
    allProjects: '*/lmthing.json',

    allProjectSpaces: (projectId: string): string =>
      `${projectId}/*/package.json`,

    // Project-scope
    projectEnvFiles: '.env*',
    spaceRoots: '*/package.json',

    // Space-scope
    allAgents: 'agents/*/instruct.md',
    agentFiles: (id: string): string => `agents/${id}/**`,

    // Tasklist globs
    allTasklists: 'tasklists/*/[0-9][0-9]-*.md',
    tasklistTasks: (name: string): string => `tasklists/${name}/[0-9][0-9]-*.md`,

    // Function globs
    allFunctions: 'functions/*.ts',

    // Component globs
    allViewComponents: 'components/view/*.tsx',
    allFormComponents: 'components/form/*.tsx',

    // Knowledge globs (index.md files identify fields)
    allKnowledgeIndexes: 'knowledge/*/*/index.md',
    allKnowledgeDomainIndexes: 'knowledge/*/index.md',
    knowledgeOptions: (domain: string, field: string): string =>
      `knowledge/${domain}/${field}/*.md`,
    // All option files across every domain/field — excludes index.md files
    allKnowledgeOptions: 'knowledge/*/*/!(index).md',
    allKnowledge: 'knowledge/**',

    allConversations: (id: string): string => `agents/${id}/conversations/*.json`,
  } as const,
} as const

export type PathBuilder = typeof P
