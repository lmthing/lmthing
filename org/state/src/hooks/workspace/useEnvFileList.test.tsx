// src/hooks/workspace/useEnvFileList.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '../../lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '../../test-utils'
import { useEnvFileList } from './useEnvFileList'

describe('useEnvFileList', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should list env files', () => {
    appFS.writeFile(getTestPath('.env'), 'KEY=value')
    appFS.writeFile(getTestPath('.env.local'), 'LOCAL=true')
    appFS.writeFile(getTestPath('.env.production'), 'PROD=true')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('.env')
    expect(result.current).toContain('.env.local')
    expect(result.current).toContain('.env.production')
  })

  it('should return empty array when no env files exist', () => {
    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should filter out non-env files', () => {
    appFS.writeFile(getTestPath('.env'), 'KEY=value')
    appFS.writeFile(getTestPath('.env.backup'), 'BACKUP=true')
    appFS.writeFile(getTestPath('.envfile.txt'), 'not an env')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('.env')
    expect(result.current).toContain('.env.backup')
    expect(result.current).not.toContain('.envfile.txt')
  })

  it('should only match .env prefix files', () => {
    appFS.writeFile(getTestPath('.env'), 'a')
    appFS.writeFile(getTestPath('.env.development'), 'b')
    appFS.writeFile(getTestPath('.env.test'), 'c')
    appFS.writeFile(getTestPath('.env.staging'), 'd')
    appFS.writeFile(getTestPath('other.txt'), 'e')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.length).toBe(4)
    expect(result.current.every(f => f.startsWith('.env'))).toBe(true)
  })

  it('should re-render when env file is added', async () => {
    appFS.writeFile(getTestPath('.env'), 'a')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    appFS.writeFile(getTestPath('.env.new'), 'b')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
    })
  })

  it('should re-render when env file is deleted', async () => {
    appFS.writeFile(getTestPath('.env'), 'a')
    appFS.writeFile(getTestPath('.env.local'), 'b')

    const { result } = renderHook(() => useEnvFileList(), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    appFS.deleteFile(getTestPath('.env'))

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount - 1)
    })
  })

  it('should not re-render when non-env file changes', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('.env'), 'KEY=value')

    const { result } = renderHook(() => {
      renderCount++
      return useEnvFileList()
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile(getTestPath('other.txt'), 'content')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
