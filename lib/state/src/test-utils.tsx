// src/test-utils.tsx
// Test utilities for setting up context providers with test data

import { createElement, ReactElement, ReactNode } from 'react'
import { renderHook, RenderHookOptions } from '@testing-library/react'
import { AppProvider } from '@/lib/contexts/AppContext'
import { StudioProvider } from '@/lib/contexts/StudioContext'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { AppFS } from '@/lib/fs/AppFS'
import { DraftStore } from '@/lib/fs/DraftStore'
import type { AppData } from '@/types/studio'

interface TestContextOptions {
  appFS?: AppFS
  draftStore?: DraftStore
  username?: string
  studioId?: string
  spaceId?: string
  studioConfig?: {
    name?: string
    spaces?: Record<string, { name: string; description?: string }>
  }
  /** If true, skip writing default config files (let tests set them up) */
  skipDefaults?: boolean
}

/**
 * Creates a wrapper function that sets up all context providers with test data.
 * Uses the provided AppFS instance and sets up proper studio/space state.
 */
export function createTestWrapper({
  appFS: providedAppFS,
  draftStore: providedDraftStore,
  username = 'alice',
  studioId = 'test',
  spaceId = 'space1',
  studioConfig = { name: 'Test Studio', spaces: { [spaceId]: { name: 'Test Space' } } },
  skipDefaults = false
}: TestContextOptions = {}) {
  const studioKey = `${username}/${studioId}`

  // Set up studio config if using custom AppFS and not skipping defaults
  if (providedAppFS && !skipDefaults) {
    const config = {
      id: studioId,
      name: studioConfig.name,
      version: '1.0.0',
      spaces: studioConfig.spaces ?? { [spaceId]: { name: 'Test Space' } },
      settings: { defaultSpace: spaceId }
    }
    providedAppFS.writeFile(`${username}/${studioId}/lmthing.json`, JSON.stringify(config, null, 2))

    // Create package.json for the space
    const packageJson = {
      name: spaceId,
      version: '1.0.0',
      private: true
    }
    providedAppFS.writeFile(`${username}/${studioId}/${spaceId}/package.json`, JSON.stringify(packageJson, null, 2))
  }

  // Create TestProviders component that passes appFS and draftStore directly
  function TestProviders({ children }: { children: ReactNode }) {
    return createElement(
      AppProvider,
      { appFS: providedAppFS, draftStore: providedDraftStore, initialStudioKey: studioKey, skipStorage: true },
      createElement(StudioProvider, undefined, createElement(SpaceProvider, undefined, children as any))
    )
  }

  return TestProviders
}

/**
 * Renders a hook with properly configured test contexts.
 */
export function renderHookWithContext<T>(
  hook: () => T,
  options: Omit<RenderHookOptions<T>, 'wrapper'> & { context?: TestContextOptions } = {}
) {
  const { context = {}, ...renderOptions } = options
  const wrapper = createTestWrapper(context)

  return renderHook(hook, { ...renderOptions, wrapper })
}

/**
 * Creates a test AppFS instance pre-configured with studio/space structure.
 */
export function createTestAppFS(
  username = 'alice',
  studioId = 'test',
  spaceId = 'space1'
): AppFS {
  const appFS = new AppFS()

  // Set up studio config
  const config = {
    id: studioId,
    name: 'Test Studio',
    version: '1.0.0',
    spaces: {
      [spaceId]: {
        name: 'Test Space',
        description: 'A test space',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    settings: { defaultSpace: spaceId }
  }
  appFS.writeFile(`${username}/${studioId}/lmthing.json`, JSON.stringify(config, null, 2))

  // Create package.json for the space
  const packageJson = {
    name: spaceId,
    version: '1.0.0',
    private: true
  }
  appFS.writeFile(`${username}/${studioId}/${spaceId}/package.json`, JSON.stringify(packageJson, null, 2))

  return appFS
}

/**
 * Helper to get the full path for a space-relative path in tests.
 */
export function testPath(path: string, username = 'alice', studioId = 'test', spaceId = 'space1'): string {
  return `${username}/${studioId}/${spaceId}/${path}`
}

/**
 * Clears localStorage between tests.
 */
export function clearTestStorage(): void {
  localStorage.clear()
}
