// src/lib/fs/paths.ts

export const P = {
  // ── App level (AppFS) ─────────────────────────────────────────────
  user: (username: string): string => `${username}`,

  studio: (username: string, studioId: string): string =>
    `${username}/${studioId}`,

  studioSpace: (username: string, studioId: string, spaceId: string): string =>
    `${username}/${studioId}/${spaceId}`,

  // ── Studio level (StudioFS — prefix already stripped) ─────────────
  studioConfig: 'lmthing.json',

  studioEnv: (suffix?: string): string => suffix ? `.env.${suffix}` : '.env',

  space: (spaceId: string): string => spaceId,

  // ── Space level (SpaceFS — prefix already stripped) ───────────────
  packageJson: 'package.json',

  agent: (id: string): string => `agents/${id}`,

  instruct: (id: string): string => `agents/${id}/instruct.md`,

  conversations: (id: string): string => `agents/${id}/conversations`,

  conversation: (id: string, cid: string): string =>
    `agents/${id}/conversations/${cid}.json`,

  // ── Tasklist paths (NEW SPEC) ──────────────────────────────────────
  tasklistDir: (name: string): string => `tasklists/${name}`,

  tasklistTask: (name: string, order: number, id: string): string =>
    `tasklists/${name}/${String(order).padStart(2, '0')}-${id}.md`,

  // ── Function paths ─────────────────────────────────────────────────
  functionFile: (name: string): string => `functions/${name}.ts`,

  // ── Component paths ───────────────────────────────────────────────
  viewComponent: (name: string): string => `components/view/${name}.tsx`,

  formComponentDir: (name: string): string => `components/form/${name}`,

  formComponentWeb: (name: string): string => `components/form/${name}/web.tsx`,

  formComponentInk: (name: string): string => `components/form/${name}/ink.tsx`,

  // ── Knowledge paths (NEW SPEC) ────────────────────────────────────
  knowledgeDir: (dir: string): string => `knowledge/${dir}`,

  knowledgeFieldDir: (domain: string, field: string): string =>
    `knowledge/${domain}/${field}`,

  knowledgeFieldIndex: (domain: string, field: string): string =>
    `knowledge/${domain}/${field}/index.md`,

  knowledgeOption: (domain: string, field: string, slug: string): string =>
    `knowledge/${domain}/${field}/${slug}.md`,

  // ── Glob patterns ─────────────────────────────────────────────────
  globs: {
    // App-scope
    allStudios: (username: string): string =>
      `${username}/*/lmthing.json`,

    allSpaces: (username: string, studioId: string): string =>
      `${username}/${studioId}/*/package.json`,

    // Studio-scope
    studioEnvFiles: '.env*',
    spaceRoots: '*/package.json',

    // Space-scope
    allAgents: 'agents/*/instruct.md',
    agentFiles: (id: string): string => `agents/${id}/**`,

    // Tasklist globs (NEW SPEC)
    allTasklists: 'tasklists/*/[0-9][0-9]-*.md',
    tasklistTasks: (name: string): string => `tasklists/${name}/[0-9][0-9]-*.md`,

    // Function globs
    allFunctions: 'functions/*.ts',

    // Component globs
    allViewComponents: 'components/view/*.tsx',
    allFormComponents: 'components/form/**/*.tsx',

    // Knowledge globs (NEW SPEC — index.md files identify fields)
    allKnowledgeIndexes: 'knowledge/*/*/index.md',
    knowledgeOptions: (domain: string, field: string): string =>
      `knowledge/${domain}/${field}/*.md`,
    allKnowledge: 'knowledge/**',

    allConversations: (id: string): string => `agents/${id}/conversations/*.json`,

    // ── Deprecated flow globs (OLD SPEC — kept for backward compat) ──
    /** @deprecated Use tasklistTasks instead */
    allFlows: 'flows/*/index.md',
    /** @deprecated Use tasklistTasks instead */
    flowTasks: (id: string): string => `flows/${id}/[0-9]*.*.md`,
    /** @deprecated */
    knowledgeFields: 'knowledge/*/config.json',
  } as const,

  // ── Deprecated flow paths (OLD SPEC — kept for backward compat) ───
  /** @deprecated Use tasklistDir instead */
  flow: (id: string): string => `flows/${id}`,
  /** @deprecated Use tasklistDir instead */
  flowIndex: (id: string): string => `flows/${id}/index.md`,
  /** @deprecated Use tasklistTask instead */
  flowTask: (id: string, order: number, name: string): string =>
    `flows/${id}/${order}.${name}.md`,
  /** @deprecated Use knowledgeFieldIndex instead */
  knowledgeConfig: (dir: string): string => `knowledge/${dir}/config.json`,
  /** @deprecated */
  knowledgeFile: (file: string): string => `knowledge/${file}.md`,

  // ── Deprecated agent file paths (OLD SPEC) ────────────────────────
  /** @deprecated The new spec has no per-agent config.json */
  agentConfig: (id: string): string => `agents/${id}/config.json`,
  /** @deprecated The new spec has no per-agent values.json */
  agentValues: (id: string): string => `agents/${id}/values.json`,
} as const

export type PathBuilder = typeof P
