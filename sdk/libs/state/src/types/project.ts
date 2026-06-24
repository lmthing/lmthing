// src/types/project.ts

export type FileTree = Record<string, string> // filePath → raw string content

export interface SpaceConfig {
  name: string
  description?: string
  tags?: string[]
  system?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProjectSettings {
  theme?: 'light' | 'dark' | 'system'
  [key: string]: unknown
}

export interface ProjectConfig {
  id: string
  name: string
  version?: string
  spaces: Record<string, SpaceConfig> // spaceId → config
  settings?: ProjectSettings
}

export interface ProjectData {
  id: string
  config: ProjectConfig
}

/**
 * App-level state. Note: under the pod-backed architecture, projects/spaces are
 * the source of truth on the pod; `AppData` is retained for compatibility but
 * the {@link AppProvider} no longer persists it to localStorage — projects come
 * live from the {@link PodTransport}.
 */
export interface AppData {
  projects: Record<string, ProjectData> // key: projectId
  currentProjectId: string | null
  currentSpaceId: string | null
}

export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

export type FileOp =
  | { type: 'write'; path: string; content: string }
  | { type: 'append'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'duplicate'; source: string; dest: string }

export type Unsubscribe = () => void

// ── Pod REST API shapes ──────────────────────────────────────────────────────

/** Project metadata, as returned by `GET /api/projects`. */
export interface PodProject {
  id: string
  name: string
  /** Epoch milliseconds OR ISO string — the pod serializes `number`; tolerate both. */
  createdAt?: number | string
}

/**
 * Space metadata, as returned by `GET /api/projects/:id/spaces`.
 * Shape mirrors `SpaceMeta` in `sdk/org/packages/cli/src/server/session-manager.ts`.
 */
export interface PodSpaceMeta {
  id: string
  name: string
  description?: string
  agents?: Array<{
    slug: string
    title: string
    actions: Array<{ id: string; label: string }>
  }>
  functionCount?: number
  componentCount?: number
  hasKnowledge?: boolean
}
