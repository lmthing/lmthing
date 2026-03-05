// src/hooks/useAgent.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgent } from './useAgent'
import { createTestWrapper, testPath } from '@/test-utils'

describe('useAgent', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return complete agent data', () => {
    const instruct = `---
name: Test Bot
model: gpt-4
---
Be helpful`

    const config = { enabled: true, temperature: 0.7 }
    const values = { apiKey: 'sk-1234' }

    appFS.writeFile(testPath('agents/bot/instruct.md'), instruct)
    appFS.writeFile(testPath('agents/bot/config.json'), JSON.stringify(config))
    appFS.writeFile(testPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.id).toBe('bot')
    expect(result.current.instruct?.name).toBe('Test Bot')
    expect(result.current.instruct?.model).toBe('gpt-4')
    expect(result.current.config?.enabled).toBe(true)
    expect(result.current.config?.temperature).toBe(0.7)
    expect(result.current.values?.apiKey).toBe('sk-1234')
  })

  it('should return nulls for non-existent agent', () => {
    const { result } = renderHook(() => useAgent('non-existent'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.id).toBe('non-existent')
    expect(result.current.instruct).toBeNull()
    expect(result.current.config).toBeNull()
    expect(result.current.values).toBeNull()
  })

  it('should handle partial agent data', () => {
    const instruct = '---\nname: Bot\n---'

    appFS.writeFile(testPath('agents/bot/instruct.md'), instruct)
    // No config or values

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.instruct?.name).toBe('Bot')
    expect(result.current.config).toBeNull()
    expect(result.current.values).toBeNull()
  })

  it('should re-render when instruct changes', async () => {
    const instruct = '---\nname: Bot\n---'
    appFS.writeFile(testPath('agents/bot/instruct.md'), instruct)

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.instruct?.name).toBe('Bot')

    const updatedInstruct = '---\nname: Updated Bot\n---'
    appFS.writeFile(testPath('agents/bot/instruct.md'), updatedInstruct)

    await waitFor(() => {
      expect(result.current.instruct?.name).toBe('Updated Bot')
    })
  })

  it('should re-render when config changes', async () => {
    const instruct = '---\nname: Bot\n---'
    const config = { enabled: true }

    appFS.writeFile(testPath('agents/bot/instruct.md'), instruct)
    appFS.writeFile(testPath('agents/bot/config.json'), JSON.stringify(config))

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.config?.enabled).toBe(true)

    const updatedConfig = { enabled: false }
    appFS.writeFile(testPath('agents/bot/config.json'), JSON.stringify(updatedConfig))

    await waitFor(() => {
      expect(result.current.config?.enabled).toBe(false)
    })
  })

  it('should re-render when values change', async () => {
    const instruct = '---\nname: Bot\n---'
    const values = { key: 'value1' }

    appFS.writeFile(testPath('agents/bot/instruct.md'), instruct)
    appFS.writeFile(testPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.values?.key).toBe('value1')

    const updatedValues = { key: 'value2' }
    appFS.writeFile(testPath('agents/bot/values.json'), JSON.stringify(updatedValues))

    await waitFor(() => {
      expect(result.current.values?.key).toBe('value2')
    })
  })

  it('should re-render when any part is created', async () => {
    const instruct = '---\nname: Bot\n---'
    appFS.writeFile(testPath('agents/newbot/instruct.md'), instruct)

    const { result } = renderHook(() => useAgent('newbot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.config).toBeNull()

    const config = { enabled: true }
    appFS.writeFile(testPath('agents/newbot/config.json'), JSON.stringify(config))

    await waitFor(() => {
      expect(result.current.config?.enabled).toBe(true)
    })
  })

  it('should re-render when any part is deleted', async () => {
    const instruct = '---\nname: Bot\n---'
    const config = { enabled: true }
    const values = { key: 'value' }

    appFS.writeFile(testPath('agents/bot/instruct.md'), instruct)
    appFS.writeFile(testPath('agents/bot/config.json'), JSON.stringify(config))
    appFS.writeFile(testPath('agents/bot/values.json'), JSON.stringify(values))

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.values).not.toBeNull()

    appFS.deleteFile(testPath('agents/bot/values.json'))

    await waitFor(() => {
      expect(result.current.values).toBeNull()
    })
  })

  it('should not re-render when different agent changes', async () => {
    let renderCount = 0

    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')
    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Bot2\n---')

    const { result } = renderHook(() => {
      renderCount++
      return useAgent('bot1')
    }, {
      wrapper: createTestWrapper({ appFS })
    })

    const initialCount = renderCount

    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
