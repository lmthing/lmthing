// src/hooks/useWorkFlow.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../lib/contexts/AppContext'
import { StudioProvider } from '../lib/contexts/StudioContext'
import { SpaceProvider } from '../lib/contexts/SpaceContext'
import { AppFS } from '../lib/fs/AppFS'
import { useWorkFlow } from './useWorkFlow'

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

describe('useWorkFlow', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return complete workflow data', () => {
    const indexContent = `---
name: My Workflow
---
- [Task One](01.task-one.md)
- [Task Two](02.task-two.md)`

    const task1Content = `---
name: Task One
---
Task one content`

    const task2Content = `---
name: Task Two
---
Task two content`

    appFS.writeFile('alice/test/space1/flows/workflow/index.md', indexContent)
    appFS.writeFile('alice/test/space1/flows/workflow/01.task-one.md', task1Content)
    appFS.writeFile('alice/test/space1/flows/workflow/02.task-two.md', task2Content)

    const { result } = renderHook(() => useWorkFlow('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.id).toBe('workflow')
    expect(result.current.index?.name).toBe('My Workflow')
    expect(result.current.index?.tasks).toEqual(['01.task-one.md', '02.task-two.md'])
    expect(result.current.tasks).toHaveLength(2)
    expect(result.current.tasks[0].name).toBe('task-one')
    expect(result.current.tasks[0].order).toBe(1)
    expect(result.current.tasks[1].name).toBe('task-two')
    expect(result.current.tasks[1].order).toBe(2)
  })

  it('should return nulls for non-existent workflow', () => {
    const { result } = renderHook(() => useWorkFlow('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.id).toBe('non-existent')
    expect(result.current.index).toBeNull()
    expect(result.current.tasks).toEqual([])
  })

  it('should handle workflow without tasks', () => {
    const indexContent = `---
name: Empty Workflow
---
`

    appFS.writeFile('alice/test/space1/flows/empty/index.md', indexContent)

    const { result } = renderHook(() => useWorkFlow('empty'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.index?.name).toBe('Empty Workflow')
    expect(result.current.tasks).toEqual([])
  })

  it('should re-render when index changes', async () => {
    const indexContent = `---
name: Flow
---
- [Task](01.task.md)`

    appFS.writeFile('alice/test/space1/flows/flow/index.md', indexContent)
    appFS.writeFile('alice/test/space1/flows/flow/01.task.md', 'content')

    const { result } = renderHook(() => useWorkFlow('flow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.index?.name).toBe('Flow')

    const updatedIndex = `---
name: Updated Flow
---
- [Task One](01.task-one.md)`

    appFS.writeFile('alice/test/space1/flows/flow/index.md', updatedIndex)

    await waitFor(() => {
      expect(result.current.index?.name).toBe('Updated Flow')
    })
  })

  it('should re-render when task is added', async () => {
    const indexContent = `---
name: Flow
---
- [Task](01.task.md)`

    appFS.writeFile('alice/test/space1/flows/flow/index.md', indexContent)
    appFS.writeFile('alice/test/space1/flows/flow/01.task.md', 'content')

    const { result } = renderHook(() => useWorkFlow('flow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.tasks).toHaveLength(1)

    appFS.writeFile('alice/test/space1/flows/flow/02.new-task.md', 'new content')

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2)
    })
  })

  it('should re-render when task is deleted', async () => {
    const indexContent = `---
name: Flow
---
- [Task One](01.task-one.md)
- [Task Two](02.task-two.md)`

    appFS.writeFile('alice/test/space1/flows/flow/index.md', indexContent)
    appFS.writeFile('alice/test/space1/flows/flow/01.task-one.md', 'content1')
    appFS.writeFile('alice/test/space1/flows/flow/02.task-two.md', 'content2')

    const { result } = renderHook(() => useWorkFlow('flow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.tasks).toHaveLength(2)

    appFS.deleteFile('alice/test/space1/flows/flow/01.task-one.md')

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1)
    })
  })

  it('should re-render when workflow is created', async () => {
    const { result } = renderHook(() => useWorkFlow('newflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.index).toBeNull()
    expect(result.current.tasks).toEqual([])

    const indexContent = `---
name: New Flow
---
- [Task](01.task.md)`

    appFS.writeFile('alice/test/space1/flows/newflow/index.md', indexContent)
    appFS.writeFile('alice/test/space1/flows/newflow/01.task.md', 'content')

    await waitFor(() => {
      expect(result.current.index?.name).toBe('New Flow')
      expect(result.current.tasks).toHaveLength(1)
    })
  })

  it('should re-render when workflow is deleted', async () => {
    const indexContent = `---
name: Flow
---
- [Task](01.task.md)`

    appFS.writeFile('alice/test/space1/flows/flow/index.md', indexContent)

    const { result } = renderHook(() => useWorkFlow('flow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.index).not.toBeNull()

    appFS.deletePath('alice/test/space1/flows/flow')

    await waitFor(() => {
      expect(result.current.index).toBeNull()
    })
  })

  it('should not re-render when different workflow changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/flows/flow1/index.md', '---\nname: Flow1\n---')
    appFS.writeFile('alice/test/space1/flows/flow2/index.md', '---\nname: Flow2\n---')

    const { result } = renderHook(() => {
      renderCount++
      return useWorkFlow('flow1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/flows/flow2/index.md', '---\nname: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle workflows with many tasks', () => {
    const tasks = Array.from({ length: 50 }, (_, i) =>
      `- [Task ${i + 1}](${String(i + 1).padStart(2, '0')}.task-${i}.md)`
    ).join('\n')

    const indexContent = `---
name: Large Workflow
---
${tasks}`

    appFS.writeFile('alice/test/space1/flows/large/index.md', indexContent)

    for (let i = 0; i < 50; i++) {
      appFS.writeFile(`alice/test/space1/flows/large/${String(i + 1).padStart(2, '0')}.task-${i}.md`, 'content')
    }

    const { result } = renderHook(() => useWorkFlow('large'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.tasks).toHaveLength(50)
  })
})
