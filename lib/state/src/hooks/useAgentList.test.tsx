// src/hooks/useAgentList.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgentList } from './useAgentList'
import { createTestWrapper, testPath } from '@/test-utils'

describe('useAgentList', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return empty array when no agents exist', () => {
    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toEqual([])
  })

  it('should list all agents by instruct.md files', () => {
    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')
    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Bot2\n---')
    appFS.writeFile(testPath('agents/bot3/instruct.md'), '---\nname: Bot3\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toHaveLength(3)
    expect(result.current.map(a => a.id)).toContain('bot1')
    expect(result.current.map(a => a.id)).toContain('bot2')
    expect(result.current.map(a => a.id)).toContain('bot3')
  })

  it('should return agent IDs as path property', () => {
    appFS.writeFile(testPath('agents/my-bot/instruct.md'), '---\nname: My Bot\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current[0].id).toBe('my-bot')
    expect(result.current[0].path).toBe('my-bot')
  })

  it('should not include directories without instruct.md', () => {
    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')
    appFS.writeFile(testPath('agents/bot2/config.json'), '{}')
    appFS.writeFile(testPath('agents/bot3/values.json'), '{}')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('bot1')
  })

  it('should re-render when new agent is created', async () => {
    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toHaveLength(1)

    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Bot2\n---')

    await waitFor(() => {
      expect(result.current).toHaveLength(2)
      expect(result.current.map(a => a.id)).toContain('bot2')
    })
  })

  it('should re-render when agent is deleted', async () => {
    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')
    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Bot2\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toHaveLength(2)

    appFS.deletePath(testPath('agents/bot1'))

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
      expect(result.current[0].id).toBe('bot2')
    })
  })

  it('should re-render when agent is renamed', async () => {
    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')
    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Bot2\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    appFS.renamePath(testPath('agents/bot1'), testPath('agents/bot1-renamed'))

    await waitFor(() => {
      expect(result.current.map(a => a.id)).toContain('bot1-renamed')
      expect(result.current.map(a => a.id)).not.toContain('bot1')
    })
  })

  it('should not re-render when unrelated files change', async () => {
    let renderCount = 0

    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')

    const { result } = renderHook(() => {
      renderCount++
      return useAgentList()
    }, {
      wrapper: createTestWrapper({ appFS })
    })

    const initialCount = renderCount

    // Change a file in agents directory that's not instruct.md
    appFS.writeFile(testPath('agents/bot1/config.json'), '{"updated": true}')

    await waitFor(() => {
      // Should not have re-rendered (only watches instruct.md)
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle agents with special characters in ID', () => {
    appFS.writeFile(testPath('agents/my-bot-123/instruct.md'), '---\nname: Bot\n---')
    appFS.writeFile(testPath('agents/agent_007/instruct.md'), '---\nname: Agent\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.map(a => a.id)).toContain('my-bot-123')
    expect(result.current.map(a => a.id)).toContain('agent_007')
  })

  it('should handle nested directories in agents', () => {
    // Create some nested directories that shouldn't be counted as agents
    appFS.writeFile(testPath('agents/bot1/instruct.md'), '---\nname: Bot1\n---')
    appFS.writeFile(testPath('agents/bot1/conversations/chat1.json'), '{}')
    appFS.writeFile(testPath('agents/bot2/instruct.md'), '---\nname: Bot2\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    // Should only count bot1 and bot2, not conversations as agents
    expect(result.current).toHaveLength(2)
  })

  it('should sort agents alphabetically', () => {
    appFS.writeFile(testPath('agents/z-bot/instruct.md'), '---\nname: Z\n---')
    appFS.writeFile(testPath('agents/a-bot/instruct.md'), '---\nname: A\n---')
    appFS.writeFile(testPath('agents/m-bot/instruct.md'), '---\nname: M\n---')

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current.map(a => a.id)).toEqual(['a-bot', 'm-bot', 'z-bot'])
  })

  it('should handle many agents efficiently', () => {
    // Create 100 agents
    for (let i = 0; i < 100; i++) {
      appFS.writeFile(testPath(`agents/bot${i}/instruct.md`), `---\nname: Bot${i}\n---`)
    }

    const { result } = renderHook(() => useAgentList(), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toHaveLength(100)
  })
})
