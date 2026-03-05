// src/hooks/flow/useFlowTaskList.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../../lib/contexts/AppContext'
import { StudioProvider } from '../../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../../lib/contexts/SpaceContext'
import { AppFS } from '../../../lib/fs/AppFS'
import { useFlowTaskList } from './useFlowTaskList'

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

describe('useFlowTaskList', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return empty array for non-existent flow', () => {
    const { result } = renderHook(() => useFlowTaskList('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should list flow tasks', () => {
    appFS.writeFile('alice/test/space1/flows/workflow/01.task-one.md', '---\nname: Task One\n---')
    appFS.writeFile('alice/test/space1/flows/workflow/02.task-two.md', '---\nname: Task Two\n---')
    appFS.writeFile('alice/test/space1/flows/workflow/index.md', '---\nname: Workflow\n---')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(2)
    expect(result.current[0].name).toBe('task-one')
    expect(result.current[0].order).toBe(1)
    expect(result.current[1].order).toBe(2)
  })

  it('should include task path', () => {
    appFS.writeFile('alice/test/space1/flows/workflow/05.task.md', 'content')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current[0].path).toBe('flows/workflow/05.task.md')
  })

  it('should not include index.md in tasks', () => {
    appFS.writeFile('alice/test/space1/flows/workflow/index.md', '---\nname: Workflow\n---')
    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', 'content')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].name).not.toBe('index')
  })

  it('should sort tasks by order number', () => {
    appFS.writeFile('alice/test/space1/flows/workflow/03.third.md', 'c')
    appFS.writeFile('alice/test/space1/flows/workflow/01.first.md', 'a')
    appFS.writeFile('alice/test/space1/flows/workflow/02.second.md', 'b')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current[0].order).toBe(1)
    expect(result.current[1].order).toBe(2)
    expect(result.current[2].order).toBe(3)
  })

  it('should re-render when task is added', async () => {
    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', 'a')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)

    appFS.writeFile('alice/test/space1/flows/workflow/02.new-task.md', 'b')

    await waitFor(() => {
      expect(result.current).toHaveLength(2)
    })
  })

  it('should re-render when task is deleted', async () => {
    appFS.writeFile('alice/test/space1/flows/workflow/01.task1.md', 'a')
    appFS.writeFile('alice/test/space1/flows/workflow/02.task2.md', 'b')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(2)

    appFS.deleteFile('alice/test/space1/flows/workflow/01.task1.md')

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
    })
  })

  it('should not re-render when different flow changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/flows/flow1/01.task.md', 'a')
    appFS.writeFile('alice/test/space1/flows/flow2/01.task.md', 'b')

    const { result } = renderHook(() => {
      renderCount++
      return useFlowTaskList('flow1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/flows/flow2/02.task.md', 'c')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle tasks with same order number', () => {
    appFS.writeFile('alice/test/space1/flows/workflow/01.a.md', 'a')
    appFS.writeFile('alice/test/space1/flows/workflow/01.b.md', 'b')
    appFS.writeFile('alice/test/space1/flows/workflow/02.c.md', 'c')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    const order1Tasks = result.current.filter(t => t.order === 1)
    expect(order1Tasks).toHaveLength(2)
  })

  it('should handle large order numbers', () => {
    appFS.writeFile('alice/test/space1/flows/workflow/999.task.md', 'content')

    const { result } = renderHook(() => useFlowTaskList('workflow'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current[0].order).toBe(999)
  })
})
