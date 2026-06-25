// src/hooks/useAgent.test.tsx
// Updated for new spec: useAgent returns { id, instruct } only (no config/values).

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgent } from './useAgent'
import { createTestWrapper, getTestPath } from '@/test-utils'

describe('useAgent', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return complete agent data from instruct.md', () => {
    const instruct = `---
title: Test Bot
knowledge:
  - cuisine/style
functions:
  - addIngredient
components:
  - PotStatus
actions:
  - id: cook_pasta
    label: "Cook Pasta"
    description: "Cook pasta"
    tasklist: make_pasta
canDelegateTo: []
---
Be helpful`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct)

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.id).toBe('bot')
    expect(result.current.instruct?.title).toBe('Test Bot')
    expect(result.current.instruct?.knowledge).toEqual(['cuisine/style'])
    expect(result.current.instruct?.functions).toEqual(['addIngredient'])
    expect(result.current.instruct?.actions[0].id).toBe('cook_pasta')
    expect(result.current.instruct?.body).toBe('Be helpful')
  })

  it('should return nulls for non-existent agent', () => {
    const { result } = renderHook(() => useAgent('non-existent'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.id).toBe('non-existent')
    expect(result.current.instruct).toBeNull()
  })

  it('should handle minimal agent data (title only)', () => {
    const instruct = '---\ntitle: Bot\n---'
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct)

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.instruct?.title).toBe('Bot')
    expect(result.current.instruct?.knowledge).toEqual([])
    expect(result.current.instruct?.actions).toEqual([])
  })

  it('should re-render when instruct changes', async () => {
    const instruct = '---\ntitle: Bot\n---\nOriginal body'
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct)

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.instruct?.title).toBe('Bot')

    const updatedInstruct = '---\ntitle: Updated Bot\n---\nNew body'
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), updatedInstruct)

    await waitFor(() => {
      expect(result.current.instruct?.title).toBe('Updated Bot')
    })
  })

  it('should re-render when agent instruct is created', async () => {
    const { result } = renderHook(() => useAgent('newbot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.instruct).toBeNull()

    appFS.writeFile(getTestPath('agents/newbot/instruct.md'), '---\ntitle: New Bot\n---')

    await waitFor(() => {
      expect(result.current.instruct?.title).toBe('New Bot')
    })
  })

  it('should re-render when agent instruct is deleted', async () => {
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), '---\ntitle: Bot\n---')

    const { result } = renderHook(() => useAgent('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.instruct).not.toBeNull()

    appFS.deleteFile(getTestPath('agents/bot/instruct.md'))

    await waitFor(() => {
      expect(result.current.instruct).toBeNull()
    })
  })

  it('should not re-render when different agent changes', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('agents/bot1/instruct.md'), '---\ntitle: Bot1\n---')
    appFS.writeFile(getTestPath('agents/bot2/instruct.md'), '---\ntitle: Bot2\n---')

    renderHook(() => {
      renderCount++
      return useAgent('bot1')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount
    appFS.writeFile(getTestPath('agents/bot2/instruct.md'), '---\ntitle: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
