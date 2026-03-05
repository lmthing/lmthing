// src/hooks/useFlowList.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../lib/contexts/AppContext'
import { StudioProvider } from '../lib/contexts/StudioContext'
import { SpaceProvider } from '../lib/contexts/SpaceContext'
import { AppFS } from '../lib/fs/AppFS'
import { useFlowList } from './useFlowList'

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

describe('useFlowList', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should list all flows', () => {
    appFS.writeFile('alice/test/space1/flows/workflow1/index.md', '---\nname: Flow1\n---')
    appFS.writeFile('alice/test/space1/flows/workflow2/index.md', '---\nname: Flow2\n---')
    appFS.writeFile('alice/test/space1/flows/workflow3/index.md', '---\nname: Flow3\n---')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(3)
    expect(result.current.map(f => f.id)).toContain('workflow1')
    expect(result.current.map(f => f.id)).toContain('workflow2')
    expect(result.current.map(f => f.id)).toContain('workflow3')
  })

  it('should return empty array when no flows exist', () => {
    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should return flow IDs as path property', () => {
    appFS.writeFile('alice/test/space1/flows/myflow/index.md', '---\nname: My Flow\n---')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current[0].id).toBe('myflow')
    expect(result.current[0].path).toBe('myflow')
  })

  it('should not include directories without index.md', () => {
    appFS.writeFile('alice/test/space1/flows/valid/index.md', '---\nname: Valid\n---')
    appFS.writeFile('alice/test/space1/flows/invalid/other.md', '# Not an index')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('valid')
  })

  it('should re-render when flow is created', async () => {
    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual([])

    appFS.writeFile('alice/test/space1/flows/newflow/index.md', '---\nname: New Flow\n---')

    await waitFor(() => {
      expect(result.current.some(f => f.id === 'newflow')).toBe(true)
    })
  })

  it('should re-render when flow is deleted', async () => {
    appFS.writeFile('alice/test/space1/flows/flow1/index.md', '---\nname: Flow1\n---')
    appFS.writeFile('alice/test/space1/flows/flow2/index.md', '---\nname: Flow2\n---')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(2)

    appFS.deletePath('alice/test/space1/flows/flow1')

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
      expect(result.current[0].id).toBe('flow2')
    })
  })

  it('should re-render when index.md is deleted', async () => {
    appFS.writeFile('alice/test/space1/flows/flow/index.md', '---\nname: Flow\n---')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)

    appFS.deleteFile('alice/test/space1/flows/flow/index.md')

    await waitFor(() => {
      expect(result.current).toHaveLength(0)
    })
  })

  it('should re-render when index.md is created', async () => {
    appFS.writeFile('alice/test/space1/flows/flow/other.md', '# Not an index')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(0)

    appFS.writeFile('alice/test/space1/flows/flow/index.md', '---\nname: Flow\n---')

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
    })
  })

  it('should not re-render when different files change', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/flows/flow1/index.md', '---\nname: Flow1\n---')
    appFS.writeFile('alice/test/space1/flows/flow1/01.task.md', 'content')

    const { result } = renderHook(() => {
      renderCount++
      return useFlowList()
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    // Modify a task file (not index.md)
    appFS.writeFile('alice/test/space1/flows/flow1/01.task.md', 'updated content')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle flows with special characters in ID', () => {
    appFS.writeFile('alice/test/space1/flows/my-flow-123/index.md', '---\nname: Flow\n---')
    appFS.writeFile('alice/test/space1/flows/flow_007/index.md', '---\nname: Flow\n---')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.map(f => f.id)).toContain('my-flow-123')
    expect(result.current.map(f => f.id)).toContain('flow_007')
  })

  it('should sort flows alphabetically', () => {
    appFS.writeFile('alice/test/space1/flows/z-flow/index.md', '---\nname: Z\n---')
    appFS.writeFile('alice/test/space1/flows/a-flow/index.md', '---\nname: A\n---')
    appFS.writeFile('alice/test/space1/flows/m-flow/index.md', '---\nname: M\n---')

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.map(f => f.id)).toEqual(['a-flow', 'm-flow', 'z-flow'])
  })

  it('should handle many flows efficiently', () => {
    for (let i = 0; i < 50; i++) {
      appFS.writeFile(`alice/test/space1/flows/flow${i}/index.md`, `---\nname: Flow${i}\n---`)
    }

    const { result } = renderHook(() => useFlowList(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toHaveLength(50)
  })
})
