// src/test-utils.tsx
/**
 * Test utilities for setting up the context providers with proper initial state.
 * All tests should use createTestWrapper to ensure contexts are properly initialized.
 *
 * Under the pod-backed architecture there is no localStorage source of truth —
 * spaces hydrate from the pod via {@link PodTransport}. For tests we install a
 * mock transport that reads/writes the same {@link AppFS} the test seeds, so the
 * {@link SpaceProvider}'s hydrate + debounced write-back loop exercises the real
 * code paths without a network.
 */

import React, { ReactNode } from 'react'
import { AppProvider } from './lib/contexts/AppContext'
import { ProjectProvider } from './lib/contexts/ProjectContext'
import { SpaceProvider } from './lib/contexts/SpaceContext'
import { AppFS } from './lib/fs/AppFS'
import { DraftStore } from './lib/fs/DraftStore'
import { PodTransport } from './lib/pod/transport'
import type { FileTree, PodProject, PodSpaceMeta } from './types/project'

const DEFAULT_PROJECT_ID = 'test'
const DEFAULT_SPACE_ID = 'space1'

export interface TestWrapperOptions {
  projectId?: string
  spaceId?: string
  /** Optional DraftStore to wire through (defaults to a new one inside AppProvider). */
  draftStore?: DraftStore
  /**
   * Seed a project config + space into AppFS under the projectId prefix and
   * register them with the mock transport. Default: true. Pass `false` (or use
   * `skipProjectSetup`) to start with an empty project.
   */
  projectConfig?: {
    name?: string
    version?: string
    spaces?: Record<string, { name?: string; description?: string }>
  }
  skipProjectSetup?: boolean
  skipPackageJsonSetup?: boolean
}

/**
 * A {@link PodTransport}-shaped mock that serves files straight out of the
 * provided {@link AppFS}. `projects`/`spaces` are derived from the seeded data.
 */
export class MockPodTransport extends PodTransport {
  private projects: PodProject[] = []
  private spacesByProject: Map<string, PodSpaceMeta[]> = new Map()

  constructor(private readonly mockAppFS: AppFS) {
    super({ baseUrl: 'mock://pod', getAccessToken: () => 'mock-token' })
  }

  /** Register a project (and optionally its spaces) with the mock. */
  registerProject(id: string, name: string, spaces: PodSpaceMeta[] = []): void {
    if (!this.projects.some((p) => p.id === id)) {
      this.projects.push({ id, name, createdAt: 0 })
    }
    this.spacesByProject.set(id, spaces)
  }

  override async listProjects(): Promise<PodProject[]> {
    return [...this.projects]
  }

  override async createProject(name: string): Promise<{ id: string }> {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
    this.registerProject(id, name)
    return { id }
  }

  override async deleteProject(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.id !== id)
    this.spacesByProject.delete(id)
  }

  override async listSpaces(projectId: string): Promise<PodSpaceMeta[]> {
    return [...(this.spacesByProject.get(projectId) ?? [])]
  }

  override async loadSpaceFiles(projectId: string, spaceId: string): Promise<FileTree> {
    const prefix = `${projectId}/${spaceId}/`
    const files: FileTree = {}
    for (const [path, content] of Object.entries(this.mockAppFS.export())) {
      if (path.startsWith(prefix)) {
        files[path.slice(prefix.length)] = content
      }
    }
    return files
  }

  override async saveSpaceFiles(
    _projectId: string,
    _spaceId: string,
    _files: FileTree,
  ): Promise<void> {
    // No-op: tests assert against the AppFS cache, which is already updated.
  }
}

/**
 * Create a wrapper that sets up AppProvider, ProjectProvider, and SpaceProvider
 * with proper initial state for testing. Seeds a project and space into `appFS`
 * automatically unless `skipProjectSetup` is true, and installs a
 * {@link MockPodTransport} so the {@link SpaceProvider} hydrates from `appFS`.
 */
export function createTestWrapper(
  appFS: AppFS,
  options: TestWrapperOptions = {},
): React.ComponentType<{ children: ReactNode }> {
  const {
    projectId = DEFAULT_PROJECT_ID,
    spaceId = DEFAULT_SPACE_ID,
    draftStore,
    projectConfig: customConfig,
    skipProjectSetup = false,
    skipPackageJsonSetup = false,
  } = options

  const transport = new MockPodTransport(appFS)

  // Set up initial project and space if not skipping.
  if (!skipProjectSetup) {
    const spaceMetas: PodSpaceMeta[] = []

    const configSpaces = customConfig?.spaces ?? {}
    const seedSpaces: Record<string, { name?: string; description?: string }> = {
      [spaceId]: configSpaces[spaceId] ?? {},
      ...configSpaces,
    }

    // Write each space's package.json so the mock transport can discover them.
    for (const [sid, meta] of Object.entries(seedSpaces)) {
      if (!skipPackageJsonSetup) {
        appFS.writeFile(`${projectId}/${sid}/package.json`, JSON.stringify({ name: sid }))
      }
      spaceMetas.push({
        id: sid,
        name: meta.name ?? sid,
        description: meta.description ?? '',
      })
    }

    appFS.writeFile(
      `${projectId}/lmthing.json`,
      JSON.stringify(
        {
          id: projectId,
          name: customConfig?.name ?? 'Test Project',
          version: customConfig?.version ?? '1.0.0',
          spaces: Object.fromEntries(
            Object.entries(seedSpaces).map(([sid, meta]) => [
              sid,
              { name: meta.name ?? sid, description: meta.description ?? '' },
            ]),
          ),
          settings: {},
        },
        null,
        2,
      ),
    )

    transport.registerProject(projectId, customConfig?.name ?? 'Test Project', spaceMetas)
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider
        appFS={appFS}
        draftStore={draftStore}
        transport={transport}
        initialProjectId={projectId}
        skipFetch={true}
      >
        <ProjectProvider projectId={projectId}>
          <SpaceProvider spaceId={skipProjectSetup ? undefined : spaceId}>
            {children}
          </SpaceProvider>
        </ProjectProvider>
      </AppProvider>
    )
  }
}

/**
 * Helper to get the default path structure for a file in the test setup.
 * E.g., getTestPath('agents/bot/instruct.md') -> 'test/space1/agents/bot/instruct.md'
 */
export function getTestPath(
  relativePath: string,
  options: TestWrapperOptions = {},
): string {
  const {
    projectId = DEFAULT_PROJECT_ID,
    spaceId = DEFAULT_SPACE_ID,
  } = options

  return `${projectId}/${spaceId}/${relativePath}`
}
