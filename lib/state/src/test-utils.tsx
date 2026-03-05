// src/test-utils.tsx
/**
 * Test utilities for setting up the context providers with proper initial state.
 * All tests should use createTestWrapper to ensure contexts are properly initialized.
 */

import React, { ReactNode } from 'react'
import { AppProvider } from './lib/contexts/AppContext'
import { StudioProvider } from './lib/contexts/StudioContext'
import { SpaceProvider } from './lib/contexts/SpaceContext'
import { AppFS } from './lib/fs/AppFS'
import type { StudioConfig } from './types/studio'

const DEFAULT_USERNAME = 'alice'
const DEFAULT_STUDIO_ID = 'test'
const DEFAULT_SPACE_ID = 'space1'

export interface TestWrapperOptions {
  username?: string
  studioId?: string
  spaceId?: string
  studioConfig?: Partial<StudioConfig>
  skipStudioSetup?: boolean
  skipPackageJsonSetup?: boolean
}

/**
 * Create a wrapper component that sets up AppProvider, StudioProvider, and SpaceProvider
 * with proper initial state for testing.
 *
 * Creates a studio and space in appFS automatically unless skipStudioSetup is true.
 */
export function createTestWrapper(
  appFS: AppFS,
  options: TestWrapperOptions = {}
): React.ComponentType<{ children: ReactNode }> {
  const {
    username = DEFAULT_USERNAME,
    studioId = DEFAULT_STUDIO_ID,
    spaceId = DEFAULT_SPACE_ID,
    studioConfig: customConfig,
    skipStudioSetup = false,
    skipPackageJsonSetup = false
  } = options

  const studioKey = `${username}/${studioId}`

  // Set up initial studio and space if not skipping
  if (!skipStudioSetup) {
    const config: StudioConfig = {
      id: studioId,
      name: customConfig?.name ?? 'Test Studio',
      version: customConfig?.version ?? '1.0.0',
      spaces: {
        [spaceId]: {
          name: customConfig?.spaces?.[spaceId]?.name ?? 'Test Space',
          description: customConfig?.spaces?.[spaceId]?.description ?? '',
          createdAt: customConfig?.spaces?.[spaceId]?.createdAt ?? new Date().toISOString(),
          updatedAt: customConfig?.spaces?.[spaceId]?.updatedAt ?? new Date().toISOString()
        },
        ...customConfig?.spaces
      },
      settings: customConfig?.settings ?? { defaultSpace: spaceId }
    }

    // Remove the default space from spaces if it's in customConfig
    if (customConfig?.spaces && !(spaceId in customConfig.spaces)) {
      delete config.spaces[spaceId]
    }

    appFS.writeFile(`${studioKey}/lmthing.json`, JSON.stringify(config, null, 2))

    if (!skipPackageJsonSetup) {
      appFS.writeFile(`${studioKey}/${spaceId}/package.json`, JSON.stringify({ name: spaceId, version: '1.0.0' }))
    }
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider appFS={appFS} skipStorage={true} initialStudioKey={studioKey}>
        <StudioProvider>
          <SpaceProvider>
            {children}
          </SpaceProvider>
        </StudioProvider>
      </AppProvider>
    )
  }
}

/**
 * Helper to get the default path structure for a file in the test setup.
 * E.g., getTestPath('agents/bot/instruct.md') -> 'alice/test/space1/agents/bot/instruct.md'
 */
export function getTestPath(
  relativePath: string,
  options: TestWrapperOptions = {}
): string {
  const {
    username = DEFAULT_USERNAME,
    studioId = DEFAULT_STUDIO_ID,
    spaceId = DEFAULT_SPACE_ID
  } = options

  return `${username}/${studioId}/${spaceId}/${relativePath}`
}
