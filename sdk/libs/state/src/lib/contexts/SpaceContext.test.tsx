// src/lib/contexts/SpaceContext.test.tsx

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AppProvider } from './AppContext'
import { ProjectProvider } from './ProjectContext'
import { SpaceProvider, useSpaceContext } from './SpaceContext'
import { AppFS } from '../fs/AppFS'
import { MockPodTransport } from '@/test-utils'
import { isRunnableSpaceFile } from '../pod/transport'
import type { FileTree, PodSpaceMeta } from '../../types/project'

/**
 * A mock transport that records every saveSpaceFiles call and serves
 * loadSpaceFiles from an in-memory file map (independent of AppFS) so we can
 * assert the hydrate path writes into AppFS.
 */
class RecordingTransport extends MockPodTransport {
  saved: Array<{ projectId: string; spaceId: string; files: FileTree }> = []
  private files: FileTree

  constructor(files: FileTree) {
    super(new AppFS()) // unused root; we override load/save.
    this.files = { ...files }
  }

  registerFor(projectId: string, spaceId: string, meta: PodSpaceMeta[] = []) {
    this.registerProject(projectId, 'Project', meta)
  }

  override async loadSpaceFiles(): Promise<FileTree> {
    return { ...this.files }
  }

  override async saveSpaceFiles(projectId: string, spaceId: string, files: FileTree): Promise<void> {
    this.saved.push({ projectId, spaceId, files: { ...files } })
  }
}

function makeWrapper(transport: RecordingTransport, appFS: AppFS, projectId: string, spaceId: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider appFS={appFS} transport={transport} initialProjectId={projectId} skipFetch>
        <ProjectProvider projectId={projectId}>
          <SpaceProvider spaceId={spaceId} saveDebounceMs={50}>
            {children}
          </SpaceProvider>
        </ProjectProvider>
      </AppProvider>
    )
  }
}

describe('SpaceProvider', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates files from the transport into AppFS on mount', async () => {
    const files: FileTree = {
      'package.json': '{"name":"s1"}',
      'agents/bot/instruct.md': 'be a bot',
    }
    const transport = new RecordingTransport(files)
    transport.registerFor('user', 's1')

    const { result } = renderHook(() => useSpaceContext(), {
      wrapper: makeWrapper(transport, appFS, 'user', 's1'),
    })

    // Flush the async hydrate.
    await vi.runAllTimersAsync()

    expect(result.current.spaceId).toBe('s1')
    await waitFor(() => {
      expect(appFS.readFile('user/s1/package.json')).toBe('{"name":"s1"}')
      expect(appFS.readFile('user/s1/agents/bot/instruct.md')).toBe('be a bot')
    })
  })

  it('debounces writes back to the transport after edits', async () => {
    const transport = new RecordingTransport({ 'package.json': '{}' })
    transport.registerFor('user', 's1')

    renderHook(() => useSpaceContext(), {
      wrapper: makeWrapper(transport, appFS, 'user', 's1'),
    })

    await vi.runAllTimersAsync()

    // Simulate an editor edit through the cache.
    act(() => {
      appFS.writeFile('user/s1/agents/bot/instruct.md', 'edited')
    })

    // Before the debounce window, nothing saved.
    expect(transport.saved).toHaveLength(0)

    // After the debounce, a save fires.
    await vi.advanceTimersByTimeAsync(60)

    expect(transport.saved).toHaveLength(1)
    const save = transport.saved[0]!
    expect(save.projectId).toBe('user')
    expect(save.spaceId).toBe('s1')
    expect(save.files['agents/bot/instruct.md']).toBe('edited')
  })

  it('filters runtime files out of the write-back', async () => {
    const transport = new RecordingTransport({ 'package.json': '{}' })
    transport.registerFor('user', 's1')

    renderHook(() => useSpaceContext(), {
      wrapper: makeWrapper(transport, appFS, 'user', 's1'),
    })

    await vi.runAllTimersAsync()

    act(() => {
      appFS.writeFile('user/s1/.env', 'SECRET=1')
      appFS.writeFile('user/s1/agents/bot/conversations/c1.json', '{}')
      appFS.writeFile('user/s1/real.md', 'hi')
    })

    await vi.advanceTimersByTimeAsync(60)

    const save = transport.saved[0]!
    expect(isRunnableSpaceFile('.env')).toBe(false) // sanity
    expect(save.files['.env']).toBeUndefined()
    expect(save.files['agents/bot/conversations/c1.json']).toBeUndefined()
    expect(save.files['real.md']).toBe('hi')
  })
})
