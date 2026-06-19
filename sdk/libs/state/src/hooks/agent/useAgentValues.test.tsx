// src/hooks/agent/useAgentValues.test.tsx
//
// The new spec exposes saved form values via the agent's instruct.md
// frontmatter (`formValues`). useAgentValues returns that map.

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgentValues } from './useAgentValues'
import { createTestWrapper, getTestPath } from '@/test-utils'

function instruct(formValues?: Record<string, Record<string, unknown>>): string {
  const lines = ['---', 'title: Bot']
  if (formValues) {
    lines.push('formValues:')
    for (const [comp, vals] of Object.entries(formValues)) {
      lines.push(`  ${comp}:`)
      for (const [k, v] of Object.entries(vals)) {
        const serialized = typeof v === 'string' ? `"${v}"` : String(v)
        lines.push(`    ${k}: ${serialized}`)
      }
    }
  }
  lines.push('---', '', 'System prompt body.')
  return lines.join('\n')
}

describe('useAgentValues', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return formValues from instruct frontmatter', () => {
    appFS.writeFile(
      getTestPath('agents/bot/instruct.md'),
      instruct({ TaskInput: { gradeLevel: '5', subject: 'math' } }),
    )

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.TaskInput?.gradeLevel).toBe('5')
    expect(result.current?.TaskInput?.subject).toBe('math')
  })

  it('should return null for non-existent agent', () => {
    const { result } = renderHook(() => useAgentValues('non-existent'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).toBeNull()
  })

  it('should return null when instruct has no formValues', () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct())

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).toBeNull()
  })

  it('should parse different value types', () => {
    appFS.writeFile(
      getTestPath('agents/bot/instruct.md'),
      instruct({ Comp: { str: 'value', num: 42, bool: true } }),
    )

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current?.Comp?.str).toBe('value')
    expect(result.current?.Comp?.num).toBe(42)
    expect(result.current?.Comp?.bool).toBe(true)
  })

  it('should re-render when formValues are updated', async () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct({ Comp: { key: 'a' } }))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current?.Comp?.key).toBe('a')

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct({ Comp: { key: 'b' } }))

    await waitFor(() => {
      expect(result.current?.Comp?.key).toBe('b')
    })
  })

  it('should re-render when instruct is deleted', async () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct({ Comp: { key: 'a' } }))

    const { result } = renderHook(() => useAgentValues('bot'), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('agents/bot/instruct.md'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})
