// src/hooks/workspace/useEnvFileList.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../../lib/contexts/AppContext'
import { StudioProvider } from '../../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../../lib/contexts/SpaceContext'
import { AppFS } from '../../../lib/fs/AppFS'
import { useEnvFileList } from './useEnvFileList'

function createWrapper(appFS: AppFS) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider>
        <StudioProvider>
          <SpaceProvider>
            {children}
          </SpaceProvider>
        </StudioProvider>
      </AppProvider>
    )
  }
}

describe('useEnvFileList', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should list env files', () => {
    appFS.writeFile('alice/test/space1/.env', 'KEY=value')
    appFS.writeFile('alice/test/space1/.env.local', 'LOCAL=true')
    appFS.writeFile('alice/test/space1/.env.production', 'PROD=true')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toContain('.env')
    expect(result.current).toContain('.env.local')
    expect(result.current).toContain('.env.production')
  })

  it('should return empty array when no env files exist', () => {
    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should filter out non-env files', () => {
    appFS.writeFile('alice/test/space1/.env', 'KEY=value')
    appFS.writeFile('alice/test/space1/.env.backup', 'BACKUP=true')
    appFS.writeFile('alice/test/space1/.envfile.txt', 'not an env')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toContain('.env')
    expect(result.current).toContain('.env.backup')
    expect(result.current).not.toContain('.envfile.txt')
  })

  it('should only match .env prefix files', () => {
    appFS.writeFile('alice/test/space1/.env', 'a')
    appFS.writeFile('alice/test/space1/.env.development', 'b')
    appFS.writeFile('alice/test/space1/.env.test', 'c')
    appFS.writeFile('alice/test/space1/.env.staging', 'd')
    appFS.writeFile('alice/test/space1/other.txt', 'e')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.length).toBe(4)
    expect(result.current.every(f => f.startsWith('.env'))).toBe(true)
  })

  it('should re-render when env file is added', async () => {
    appFS.writeFile('alice/test/space1/.env', 'a')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    appFS.writeFile('alice/test/space1/.env.new', 'b')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
    })
  })

  it('should re-render when env file is deleted', async () => {
    appFS.writeFile('alice/test/space1/.env', 'a')
    appFS.writeFile('alice/test/space1/.env.local', 'b')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    appFS.deleteFile('alice/test/space1/.env')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount - 1)
    })
  })

  it('should not re-render when non-env file changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/.env', 'KEY=value')

    const { result } = renderHook(() => {
      renderCount++
      return useEnvFileList()
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/other.txt', 'content')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
