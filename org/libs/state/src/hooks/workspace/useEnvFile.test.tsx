// src/hooks/workspace/useEnvFile.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '../../lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '../../test-utils'
import { useEnvFile } from './useEnvFile'

describe('useEnvFile', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse env file', () => {
    const env = 'KEY=value\nDEBUG=true\nCOUNT=42'
    appFS.writeFile(getTestPath('.env'), env)

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual({ KEY: 'value', DEBUG: 'true', COUNT: '42' })
  })

  it('should return null for non-existent env file', () => {
    const { result } = renderHook(() => useEnvFile('nonexistent'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle default .env file', () => {
    appFS.writeFile(getTestPath('.env'), 'KEY=value')

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.KEY).toBe('value')
  })

  it('should handle named env files', () => {
    appFS.writeFile(getTestPath('.env.production'), 'API_KEY=prod-key')

    const { result } = renderHook(() => useEnvFile('production'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.API_KEY).toBe('prod-key')
  })

  it('should handle env file with leading .env', () => {
    appFS.writeFile(getTestPath('.env.local'), 'LOCAL=true')

    const { result } = renderHook(() => useEnvFile('local'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.LOCAL).toBe('true')
  })

  it('should ignore comments and empty lines', () => {
    const env = '# Comment\n\nKEY=value\n\n# Another comment\nDEBUG=true'
    appFS.writeFile(getTestPath('.env'), env)

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual({ KEY: 'value', DEBUG: 'true' })
  })

  it('should handle quoted values', () => {
    const env = 'KEY="quoted value"\nDEBUG=true'
    appFS.writeFile(getTestPath('.env'), env)

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.KEY).toBe('quoted value')
  })

  it('should handle values with equals signs', () => {
    const env = 'CONNECTION=host=localhost&port=5432'
    appFS.writeFile(getTestPath('.env'), env)

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.CONNECTION).toBe('host=localhost&port=5432')
  })

  it('should handle encrypted env files as error', () => {
    const encrypted = '-----BEGIN ENCRYPTED ENV-----\nencrypted-content\n-----END ENCRYPTED ENV-----'
    appFS.writeFile(getTestPath('.env'), encrypted)

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    // Encrypted files return null (need to decrypt first)
    expect(result.current).toBeNull()
  })

  it('should re-render when env file is updated', async () => {
    appFS.writeFile(getTestPath('.env'), 'KEY=original')

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.KEY).toBe('original')

    appFS.writeFile(getTestPath('.env'), 'KEY=updated')

    await waitFor(() => {
      expect(result.current?.KEY).toBe('updated')
    })
  })

  it('should re-render when env file is created', async () => {
    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()

    appFS.writeFile(getTestPath('.env'), 'NEW=value')

    await waitFor(() => {
      expect(result.current?.NEW).toBe('value')
    })
  })

  it('should re-render when env file is deleted', async () => {
    appFS.writeFile(getTestPath('.env'), 'KEY=value')

    const { result } = renderHook(() => useEnvFile(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('.env'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different env file changes', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('.env'), 'KEY1=value1')
    appFS.writeFile(getTestPath('.env.local'), 'KEY2=value2')

    const { result } = renderHook(() => {
      renderCount++
      return useEnvFile() // default .env
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile(getTestPath('.env.local'), 'KEY2=updated')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
