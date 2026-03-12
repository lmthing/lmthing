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

  agentConfig: (id: string): string => `agents/${id}/config.json`,

  agentValues: (id: string): string => `agents/${id}/values.json`,

  conversations: (id: string): string => `agents/${id}/conversations`,

  conversation: (id: string, cid: string): string =>
    `agents/${id}/conversations/${cid}.json`,

  flow: (id: string): string => `flows/${id}`,

  flowIndex: (id: string): string => `flows/${id}/index.md`,

  flowTask: (id: string, order: number, name: string): string =>
    `flows/${id}/${order}.${name}.md`,

  knowledgeDir: (dir: string): string => `knowledge/${dir}`,

  knowledgeConfig: (dir: string): string => `knowledge/${dir}/config.json`,

  knowledgeFile: (file: string): string => `knowledge/${file}.md`,

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
    allFlows: 'flows/*/index.md',
    flowTasks: (id: string): string => `flows/${id}/[0-9]*.*.md`,
    allConversations: (id: string): string => `agents/${id}/conversations/*.json`,
    knowledgeFields: 'knowledge/*/config.json',
    allKnowledge: 'knowledge/**',
  } as const,
} as const

export type PathBuilder = typeof P
