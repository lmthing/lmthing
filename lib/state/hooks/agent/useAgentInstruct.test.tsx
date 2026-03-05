// src/hooks/agent/useAgentInstruct.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../../lib/contexts/AppContext'
import { StudioProvider } from '../../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../../lib/contexts/SpaceContext'
import { AppFS } from '../../../lib/fs/AppFS'
import { P } from '../../../lib/fs/paths'
import { useAgentInstruct } from './useAgentInstruct'

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

describe('useAgentInstruct', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse agent instruct with frontmatter', () => {
    const content = `---
name: Test Bot
description: A test agent
model: gpt-4
---
You are a helpful assistant.`

    appFS.writeFile('alice/test/space1/agents/bot/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('Test Bot')
    expect(result.current?.description).toBe('A test agent')
    expect(result.current?.model).toBe('gpt-4')
    expect(result.current?.instructions).toBe('You are a helpful assistant.')
  })

  it('should return null for non-existent agent', () => {
    const { result } = renderHook(() => useAgentInstruct('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle instruct without frontmatter', () => {
    const content = 'Just instructions, no frontmatter'

    appFS.writeFile('alice/test/space1/agents/simple/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('simple'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('')
    expect(result.current?.instructions).toBe('Just instructions, no frontmatter')
  })

  it('should parse all instruct fields', () => {
    const content = `---
name: Advanced Bot
description: An advanced agent
model: gpt-4
temperature: 0.7
max-tokens: 2000
system-prompt: You are advanced.
---
Follow these instructions carefully.`

    appFS.writeFile('alice/test/space1/agents/advanced/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('advanced'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.name).toBe('Advanced Bot')
    expect(result.current?.temperature).toBe(0.7)
    expect(result.current?.maxTokens).toBe(2000)
    expect(result.current?.systemPrompt).toBe('You are advanced.')
    expect(result.current?.instructions).toBe('Follow these instructions carefully.')
  })

  it('should re-render when instruct is updated', async () => {
    const initialContent = `---
name: Bot
---
Original instructions`

    appFS.writeFile('alice/test/space1/agents/bot/instruct.md', initialContent)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.instructions).toBe('Original instructions')

    const updatedContent = `---
name: Bot
---
Updated instructions`

    appFS.writeFile('alice/test/space1/agents/bot/instruct.md', updatedContent)

    await waitFor(() => {
      expect(result.current?.instructions).toBe('Updated instructions')
    })
  })

  it('should re-render when instruct is created', async () => {
    const { result } = renderHook(() => useAgentInstruct('newbot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const content = `---
name: New Bot
---
New instructions`

    appFS.writeFile('alice/test/space1/agents/newbot/instruct.md', content)

    await waitFor(() => {
      expect(result.current).not.toBeNull()
      expect(result.current?.name).toBe('New Bot')
    })
  })

  it('should re-render when instruct is deleted', async () => {
    const content = `---
name: Bot
---
Instructions`

    appFS.writeFile('alice/test/space1/agents/bot/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/agents/bot/instruct.md')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different agent is updated', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/agents/bot1/instruct.md', '---\nname: Bot1\n---')
    appFS.writeFile('alice/test/space1/agents/bot2/instruct.md', '---\nname: Bot2\n---')

    const { result } = renderHook(() => {
      renderCount++
      return useAgentInstruct('bot1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    // Update different agent
    appFS.writeFile('alice/test/space1/agents/bot2/instruct.md', '---\nname: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle multi-line instructions', () => {
    const content = `---
name: Bot
---
Line 1
Line 2
Line 3`

    appFS.writeFile('alice/test/space1/agents/bot/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.instructions).toBe('Line 1\nLine 2\nLine 3')
  })

  it('should handle special characters in agent ID', () => {
    const content = '---\nname: Bot\n---'

    appFS.writeFile('alice/test/space1/agents/my-bot-123/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('my-bot-123'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.name).toBe('Bot')
  })

  it('should handle empty instructions', () => {
    const content = `---
name: Bot
---
`

    appFS.writeFile('alice/test/space1/agents/bot/instruct.md', content)

    const { result } = renderHook(() => useAgentInstruct('bot'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.instructions).toBe('')
  })
})
