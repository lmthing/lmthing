// src/hooks/agent/useAgentValues.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgentValues } from './useAgentValues'
import { createTestWrapper, getTestPath } from '@/test-utils'

describe('useAgentValues', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse agent values', () => {
    const values = {
      apiKey: 'sk-1234',
      endpoint: 'https://api.example.com',
      maxRetries: 3
    }

    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.apiKey).toBe('sk-1234')
    expect(result.current?.endpoint).toBe('https://api.example.com')
    expect(result.current?.maxRetries).toBe(3)
  })

  it('should return null for non-existent agent', () => {
    const { result } = renderHook(() => useAgentValues('non-existent'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    appFS.writeFile(getTestPath('agents/bot/values.json'), 'not json')

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current).toEqual({})
  })

  it('should parse different value types', () => {
    const values = {
      string: 'value',
      number: 42,
      float: 3.14,
      bool: true,
      nullValue: null
    }

    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current?.string).toBe('value')
    expect(result.current?.number).toBe(42)
    expect(result.current?.float).toBe(3.14)
    expect(result.current?.bool).toBe(true)
    expect(result.current?.nullValue).toBe(null)
  })

  it('should handle empty values', () => {
    appFS.writeFile(getTestPath('agents/bot/values.json'), '{}')

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current).toEqual({})
  })

  it('should re-render when values are updated', async () => {
    const initialValues = { apiKey: 'sk-1234' }
    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(initialValues))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current?.apiKey).toBe('sk-1234')

    const updatedValues = { apiKey: 'sk-5678', endpoint: 'https://api.example.com' }
    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(updatedValues))

    await waitFor(() => {
      expect(result.current?.apiKey).toBe('sk-5678')
      expect(result.current?.endpoint).toBe('https://api.example.com')
    })
  })

  it('should re-render when values are created', async () => {
    const { result } = renderHook(() => useAgentValues('newbot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current).toBeNull()

    const values = { apiKey: 'sk-1234' }
    appFS.writeFile(getTestPath('agents/newbot/values.json'), JSON.stringify(values))

    await waitFor(() => {
      expect(result.current?.apiKey).toBe('sk-1234')
    })
  })

  it('should re-render when values are deleted', async () => {
    const values = { apiKey: 'sk-1234' }
    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('agents/bot/values.json'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different agent changes', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('agents/bot1/values.json'), JSON.stringify({ key: '1' }))
    appFS.writeFile(getTestPath('agents/bot2/values.json'), JSON.stringify({ key: '2' }))

    const { result } = renderHook(() => {
      renderCount++
      return useAgentValues('bot1')
    }, {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    const initialCount = renderCount

    appFS.writeFile(getTestPath('agents/bot2/values.json'), JSON.stringify({ key: 'updated' }))

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle nested objects in values', () => {
    const values = {
      config: {
        nested: {
          value: 'deep'
        }
      }
    }

    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current?.config?.nested?.value).toBe('deep')
  })

  it('should handle arrays in values', () => {
    const values = {
      tags: ['tag1', 'tag2', 'tag3'],
      numbers: [1, 2, 3]
    }

    appFS.writeFile(getTestPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current?.tags).toEqual(['tag1', 'tag2', 'tag3'])
    expect(result.current?.numbers).toEqual([1, 2, 3])
  })
})
