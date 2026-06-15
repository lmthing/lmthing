// src/hooks/agent/useAgentInstruct.test.tsx
// Updated for the NEW spec AgentInstruct shape.

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useAgentInstruct } from './useAgentInstruct'
import { createTestWrapper, getTestPath } from '@/test-utils'

describe('useAgentInstruct', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse agent instruct with frontmatter', () => {
    const content = `---
title: Test Bot
knowledge: []
functions: []
components: []
actions: []
dependencies: []
---
You are a helpful assistant.`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.title).toBe('Test Bot')
    expect(result.current?.body).toBe('You are a helpful assistant.')
    expect(result.current?.knowledge).toEqual([])
    expect(result.current?.functions).toEqual([])
    expect(result.current?.actions).toEqual([])
  })

  it('should return null for non-existent agent', () => {
    const { result } = renderHook(() => useAgentInstruct('non-existent'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle instruct without frontmatter', () => {
    const content = 'Just a body, no frontmatter'

    appFS.writeFile(getTestPath('agents/simple/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('simple'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.title).toBe('')
    expect(result.current?.body).toBe('Just a body, no frontmatter')
  })

  it('should parse all instruct fields', () => {
    const content = `---
title: Chef
knowledge:
  - cuisine/style
functions:
  - addIngredient
  - checkPot
components:
  - PotStatus
actions:
  - id: cook_pasta
    label: "Cook Pasta"
    description: "Make pasta"
    tasklist: make_pasta
defaultAction: cook_pasta
dependencies:
  - sommelier-space/pairing
---
You are an expert chef.`

    appFS.writeFile(getTestPath('agents/chef/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('chef'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.title).toBe('Chef')
    expect(result.current?.knowledge).toEqual(['cuisine/style'])
    expect(result.current?.functions).toEqual(['addIngredient', 'checkPot'])
    expect(result.current?.components).toEqual(['PotStatus'])
    expect(result.current?.actions[0].id).toBe('cook_pasta')
    expect(result.current?.actions[0].tasklist).toBe('make_pasta')
    expect(result.current?.defaultAction).toBe('cook_pasta')
    expect(result.current?.dependencies).toEqual(['sommelier-space/pairing'])
    expect(result.current?.body).toBe('You are an expert chef.')
  })

  it('should re-render when instruct is updated', async () => {
    const initialContent = `---
title: Bot
---
Original body`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), initialContent)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.body).toBe('Original body')

    const updatedContent = `---
title: Bot
---
Updated body`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), updatedContent)

    await waitFor(() => {
      expect(result.current?.body).toBe('Updated body')
    })
  })

  it('should re-render when instruct is created', async () => {
    const { result } = renderHook(() => useAgentInstruct('newbot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const content = `---
title: New Bot
---
New body`

    appFS.writeFile(getTestPath('agents/newbot/instruct.md'), content)

    await waitFor(() => {
      expect(result.current).not.toBeNull()
      expect(result.current?.title).toBe('New Bot')
    })
  })

  it('should re-render when instruct is deleted', async () => {
    const content = `---
title: Bot
---
Body`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    appFS.deleteFile(getTestPath('agents/bot/instruct.md'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different agent is updated', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('agents/bot1/instruct.md'), '---\ntitle: Bot1\n---')
    appFS.writeFile(getTestPath('agents/bot2/instruct.md'), '---\ntitle: Bot2\n---')

    renderHook(() => {
      renderCount++
      return useAgentInstruct('bot1')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount
    appFS.writeFile(getTestPath('agents/bot2/instruct.md'), '---\ntitle: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle multi-line body', () => {
    const content = `---
title: Bot
---
Line 1
Line 2
Line 3`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.body).toBe('Line 1\nLine 2\nLine 3')
  })

  it('should handle special characters in agent ID', () => {
    const content = '---\ntitle: Bot\n---\n'

    appFS.writeFile(getTestPath('agents/my-bot-123/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('my-bot-123'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.title).toBe('Bot')
  })

  it('should handle empty body', () => {
    const content = `---
title: Bot
---
`

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.body).toBe('')
  })
})
