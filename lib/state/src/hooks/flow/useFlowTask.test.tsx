// src/hooks/flow/useFlowTask.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../lib/contexts/AppContext'
import { StudioProvider } from '../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../lib/contexts/SpaceContext'
import { AppFS } from '../../lib/fs/AppFS'
import { useFlowTask } from './useFlowTask'

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

describe('useFlowTask', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse flow task with frontmatter', () => {
    const content = `---
name: Task One
description: First task
agent: bot-1
---
Task instructions go here`

    appFS.writeFile('alice/test/space1/flows/workflow/01.task-one.md', content)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'task-one'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('Task One')
    expect(result.current?.description).toBe('First task')
    expect(result.current?.agent).toBe('bot-1')
    expect(result.current?.content).toBe('Task instructions go here')
  })

  it('should return null for non-existent task', () => {
    const { result } = renderHook(() => useFlowTask('workflow', 1, 'non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle task without frontmatter', () => {
    const content = 'Just task content'

    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', content)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'task'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.name).toBe('')
    expect(result.current?.content).toBe('Just task content')
  })

  it('should parse all task fields', () => {
    const content = `---
name: Complex Task
description: A complex task
agent: bot-1
inputs: {prompt: "hello"}
outputs: {result: "output"}
---
Execute this task`

    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', content)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'task'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.name).toBe('Complex Task')
    expect(result.current?.inputs).toEqual({ prompt: 'hello' })
    expect(result.current?.outputs).toEqual({ result: 'output' })
    expect(result.current?.content).toBe('Execute this task')
  })

  it('should re-render when task is updated', async () => {
    const initialContent = `---
name: Task
---
Original content`

    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', initialContent)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'task'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.content).toBe('Original content')

    const updatedContent = `---
name: Task
---
Updated content`

    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', updatedContent)

    await waitFor(() => {
      expect(result.current?.content).toBe('Updated content')
    })
  })

  it('should re-render when task is created', async () => {
    const { result } = renderHook(() => useFlowTask('workflow', 1, 'newtask'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const content = `---
name: New Task
---
New content`

    appFS.writeFile('alice/test/space1/flows/workflow/01.newtask.md', content)

    await waitFor(() => {
      expect(result.current?.name).toBe('New Task')
    })
  })

  it('should re-render when task is deleted', async () => {
    const content = `---
name: Task
---
Content`

    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', content)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'task'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/flows/workflow/01.task.md')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different task changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/flows/workflow/01.task1.md', '---\nname: Task1\n---')
    appFS.writeFile('alice/test/space1/flows/workflow/02.task2.md', '---\nname: Task2\n---')

    const { result } = renderHook(() => {
      renderCount++
      return useFlowTask('workflow', 1, 'task1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/flows/workflow/02.task2.md', '---\nname: Updated\n---')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle multi-line content', () => {
    const content = `---
name: Task
---
Step 1
Step 2
Step 3`

    appFS.writeFile('alice/test/space1/flows/workflow/01.task.md', content)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'task'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.content).toBe('Step 1\nStep 2\nStep 3')
  })

  it('should handle tasks with special characters in name', () => {
    const content = '---\nname: Task\n---'

    appFS.writeFile('alice/test/space1/flows/workflow/01.my-task-123.md', content)

    const { result } = renderHook(() => useFlowTask('workflow', 1, 'my-task-123'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.name).toBe('Task')
  })
})
