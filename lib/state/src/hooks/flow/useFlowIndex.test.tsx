// src/hooks/flow/useFlowIndex.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useFlowIndex } from './useFlowIndex'
import { createTestWrapper, getTestPath } from '@/test-utils'

describe('useFlowIndex', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse flow index with frontmatter', () => {
    const content = `---
name: My Workflow
description: A test workflow
---
- [Step One](01.step-one.md)
- [Step Two](02.step-two.md)`

    appFS.writeFile(getTestPath('flows/workflow/index.md'), content)

    const { result } = renderHook(() => useFlowIndex('workflow'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('My Workflow')
    expect(result.current?.description).toBe('A test workflow')
    expect(result.current?.tasks).toEqual(['01.step-one.md', '02.step-two.md'])
  })

  it('should return null for non-existent flow', () => {
    const { result } = renderHook(() => useFlowIndex('non-existent'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle index without frontmatter', () => {
    const content = `- [Task](01.task.md)`

    appFS.writeFile(getTestPath('flows/simple/index.md'), content)

    const { result } = renderHook(() => useFlowIndex('simple'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.name).toBe('')
    expect(result.current?.tasks).toEqual(['01.task.md'])
  })

  it('should handle empty task list', () => {
    const content = `---
name: Empty Flow
---
`

    appFS.writeFile(getTestPath('flows/empty/index.md'), content)

    const { result } = renderHook(() => useFlowIndex('empty'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.tasks).toEqual([])
  })

  it('should re-render when index is updated', async () => {
    const initialContent = `---
name: Flow
---
- [Task](01.task.md)`

    appFS.writeFile(getTestPath('flows/flow/index.md'), initialContent)

    const { result } = renderHook(() => useFlowIndex('flow'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.tasks).toHaveLength(1)

    const updatedContent = `---
name: Flow
---
- [Task One](01.task-one.md)
- [Task Two](02.task-two.md)`

    appFS.writeFile(getTestPath('flows/flow/index.md'), updatedContent)

    await waitFor(() => {
      expect(result.current?.tasks).toHaveLength(2)
    })
  })

  it('should re-render when index is created', async () => {
    const { result } = renderHook(() => useFlowIndex('newflow'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const content = `---
name: New Flow
---
- [Task](01.task.md)`

    appFS.writeFile(getTestPath('flows/newflow/index.md'), content)

    await waitFor(() => {
      expect(result.current?.name).toBe('New Flow')
    })
  })

  it('should re-render when index is deleted', async () => {
    const content = `---
name: Flow
---
- [Task](01.task.md)`

    appFS.writeFile(getTestPath('flows/flow/index.md'), content)

    const { result } = renderHook(() => useFlowIndex('flow'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('flows/flow/index.md'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different flow changes', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('flows/flow1/index.md'), '---\nname: Flow1\n---')
    appFS.writeFile(getTestPath('flows/flow2/index.md'), '---\nname: Flow2\n---')

    const { result } = renderHook(() => {
      renderCount++
      return useFlowIndex('flow1')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile(getTestPath('flows/flow2/index.md'), '---\nname: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle flows with many tasks', () => {
    const tasks = Array.from({ length: 50 }, (_, i) => `- [Task ${i + 1}](${String(i + 1).padStart(2, '0')}.task-${i + 1}.md)`).join('\n')
    const content = `---
name: Large Flow
---
${tasks}`

    appFS.writeFile(getTestPath('flows/large/index.md'), content)

    const { result } = renderHook(() => useFlowIndex('large'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.tasks).toHaveLength(50)
  })
})
