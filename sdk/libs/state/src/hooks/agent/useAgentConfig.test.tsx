// src/hooks/agent/useAgentConfig.test.tsx
//
// The new spec exposes runtime field selections via the agent's instruct.md
// frontmatter (`runtimeFields`). useAgentConfig returns that map.

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgentConfig } from './useAgentConfig'
import { createTestWrapper, getTestPath } from '@/test-utils'

function instruct(runtimeFields?: Record<string, string[]>): string {
  const lines = ['---', 'title: Bot']
  if (runtimeFields) {
    lines.push('runtimeFields:')
    for (const [comp, fields] of Object.entries(runtimeFields)) {
      lines.push(`  ${comp}:`)
      for (const f of fields) lines.push(`    - ${f}`)
    }
  }
  lines.push('---', '', 'System prompt body.')
  return lines.join('\n')
}

describe('useAgentConfig', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return runtimeFields from instruct frontmatter', () => {
    appFS.writeFile(
      getTestPath('agents/bot/instruct.md'),
      instruct({ TaskInput: ['curriculum/unit-focus', 'curriculum/grade-level'] }),
    )

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.TaskInput).toEqual(['curriculum/unit-focus', 'curriculum/grade-level'])
  })

  it('should return null for non-existent agent', () => {
    const { result } = renderHook(() => useAgentConfig('non-existent'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).toBeNull()
  })

  it('should return null when instruct has no runtimeFields', () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct())

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).toBeNull()
  })

  it('should re-render when runtimeFields are updated', async () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct({ A: ['x/1'] }))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current?.A).toEqual(['x/1'])

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct({ A: ['x/2'], B: ['y/1'] }))

    await waitFor(() => {
      expect(result.current?.A).toEqual(['x/2'])
      expect(result.current?.B).toEqual(['y/1'])
    })
  })

  it('should re-render when instruct is deleted', async () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct({ A: ['x/1'] }))

    const { result } = renderHook(() => useAgentConfig('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('agents/bot/instruct.md'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should handle agents with special characters in ID', () => {
    appFS.writeFile(getTestPath('agents/my-bot-123/instruct.md'), instruct({ A: ['x/1'] }))

    const { result } = renderHook(() => useAgentConfig('my-bot-123'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current?.A).toEqual(['x/1'])
  })
})
