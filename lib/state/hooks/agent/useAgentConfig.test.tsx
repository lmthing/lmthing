// src/hooks/agent/useAgentConfig.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../../lib/contexts/AppContext'
import { StudioProvider } from '../../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../../lib/contexts/SpaceContext'
import { AppFS } from '../../../lib/fs/AppFS'
import { useAgentConfig } from './useAgentConfig'

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

describe('useAgentConfig', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse agent config', () => {
    const config = {
      enabled: true,
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000
    }

    appFS.writeFile('alice/test/space1/agents/bot/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.enabled).toBe(true)
    expect(result.current?.model).toBe('gpt-4')
    expect(result.current?.temperature).toBe(0.7)
    expect(result.current?.maxTokens).toBe(2000)
  })

  it('should return null for non-existent agent', () => {
    const { result } = renderHook(() => useAgentConfig('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    appFS.writeFile('alice/test/space1/agents/bot/config.json', 'not json')

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual({})
  })

  it('should parse all config fields', () => {
    const config = {
      enabled: true,
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      stopSequences: ['STOP', 'END'],
      timeout: 30000,
      retries: 3,
      customField: 'custom'
    }

    appFS.writeFile('alice/test/space1/agents/bot/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.frequencyPenalty).toBe(0.5)
    expect(result.current?.stopSequences).toEqual(['STOP', 'END'])
    expect(result.current?.timeout).toBe(30000)
    expect(result.current?.customField).toBe('custom')
  })

  it('should handle empty config', () => {
    appFS.writeFile('alice/test/space1/agents/bot/config.json', '{}')

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual({})
  })

  it('should re-render when config is updated', async () => {
    const initialConfig = { enabled: true }
    appFS.writeFile('alice/test/space1/agents/bot/config.json', JSON.stringify(initialConfig))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.enabled).toBe(true)

    const updatedConfig = { enabled: false, model: 'gpt-4' }
    appFS.writeFile('alice/test/space1/agents/bot/config.json', JSON.stringify(updatedConfig))

    await waitFor(() => {
      expect(result.current?.enabled).toBe(false)
      expect(result.current?.model).toBe('gpt-4')
    })
  })

  it('should re-render when config is created', async () => {
    const { result } = renderHook(() => useAgentConfig('newbot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const config = { enabled: true }
    appFS.writeFile('alice/test/space1/agents/newbot/config.json', JSON.stringify(config))

    await waitFor(() => {
      expect(result.current?.enabled).toBe(true)
    })
  })

  it('should re-render when config is deleted', async () => {
    const config = { enabled: true }
    appFS.writeFile('alice/test/space1/agents/bot/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/agents/bot/config.json')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different agent changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/agents/bot1/config.json', JSON.stringify({ enabled: true }))
    appFS.writeFile('alice/test/space1/agents/bot2/config.json', JSON.stringify({ enabled: true }))

    const { result } = renderHook(() => {
      renderCount++
      return useAgentConfig('bot1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/agents/bot2/config.json', JSON.stringify({ enabled: false }))

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle null values in config', () => {
    const config = {
      enabled: null,
      model: 'gpt-4'
    }

    appFS.writeFile('alice/test/space1/agents/bot/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.enabled).toBe(null)
    expect(result.current?.model).toBe('gpt-4')
  })

  it('should handle agents with special characters in ID', () => {
    const config = { enabled: true }
    appFS.writeFile('alice/test/space1/agents/my-bot-123/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useAgentConfig('my-bot-123'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.enabled).toBe(true)
  })
})
