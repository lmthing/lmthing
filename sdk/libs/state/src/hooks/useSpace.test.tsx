// src/hooks/useSpace.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useSpace } from './useSpace'
import { createTestWrapper, getTestPath } from '@/test-utils'

describe('useSpace', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should return complete space data', () => {
    const pkg = { name: 'myspace', version: '1.0.0' }

    const bot1Instruct = '---\nname: Bot1\n---'
    const bot2Instruct = '---\nname: Bot2\n---'

    const domainIndex = '---\nlabel: "Engineering"\nrenderAs: section\n---\nEngineering knowledge.'

    const wrapper = createTestWrapper(appFS)

    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))
    appFS.writeFile(getTestPath('agents/bot1/instruct.md'), bot1Instruct)
    appFS.writeFile(getTestPath('agents/bot2/instruct.md'), bot2Instruct)
    appFS.writeFile(getTestPath('tasklists/workflow/01-task.md'), '---\nid: task\n---\ncontent')
    appFS.writeFile(getTestPath('knowledge/engineering/index.md'), domainIndex)

    const { result } = renderHook(() => useSpace(), {
      wrapper
    })

    expect(result.current.packageJson?.name).toBe('myspace')
    expect(result.current.agents).toHaveLength(2)
    expect(result.current.agents[0].id).toBe('bot1')
    expect(result.current.tasklists).toHaveLength(1)
    expect(result.current.tasklists[0].name).toBe('workflow')
    expect(result.current.domains).toHaveLength(1)
    expect(result.current.domains[0].id).toBe('engineering')
  })

  it('should handle empty space', () => {
    const pkg = { name: 'empty' }
    const wrapper = createTestWrapper(appFS)
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => useSpace(), {
      wrapper
    })

    expect(result.current.packageJson?.name).toBe('empty')
    expect(result.current.agents).toEqual([])
    expect(result.current.tasklists).toEqual([])
    expect(result.current.domains).toEqual([])
  })

  it('should re-render when package.json changes', async () => {
    const pkg = { name: 'space', version: '1.0.0' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.packageJson?.version).toBe('1.0.0')

    const updatedPkg = { name: 'space', version: '2.0.0' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(updatedPkg))

    await waitFor(() => {
      expect(result.current.packageJson?.version).toBe('2.0.0')
    })
  })

  it('should re-render when agent is added', async () => {
    const pkg = { name: 'space' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.agents).toHaveLength(0)

    appFS.writeFile(getTestPath('agents/bot/instruct.md'), '---\nname: Bot\n---')

    await waitFor(() => {
      expect(result.current.agents).toHaveLength(1)
    })
  })

  it('should re-render when tasklist is added', async () => {
    const pkg = { name: 'space' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.tasklists).toHaveLength(0)

    appFS.writeFile(getTestPath('tasklists/newflow/01-step.md'), '---\nid: step\n---')

    await waitFor(() => {
      expect(result.current.tasklists).toHaveLength(1)
    })
  })

  it('should re-render when knowledge domain is added', async () => {
    const pkg = { name: 'space' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.domains).toHaveLength(0)

    appFS.writeFile(getTestPath('knowledge/domain/index.md'), '---\nlabel: "Domain"\n---')

    await waitFor(() => {
      expect(result.current.domains).toHaveLength(1)
    })
  })

  it('should re-render when agent is deleted', async () => {
    const pkg = { name: 'space' }
    const instruct = '---\nname: Bot\n---'

    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))
    appFS.writeFile(getTestPath('agents/bot/instruct.md'), instruct)

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.agents).toHaveLength(1)

    appFS.deletePath(getTestPath('agents/bot'))

    await waitFor(() => {
      expect(result.current.agents).toHaveLength(0)
    })
  })

  it('should handle many agents', () => {
    const pkg = { name: 'space' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    for (let i = 0; i < 20; i++) {
      appFS.writeFile(getTestPath(`agents/bot${i}/instruct.md`), `---\nname: Bot${i}\n---`)
    }

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.agents).toHaveLength(20)
  })

  it('should handle many tasklists', () => {
    const pkg = { name: 'space' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    for (let i = 0; i < 10; i++) {
      appFS.writeFile(getTestPath(`tasklists/flow${i}/01-step.md`), `---\nid: step\n---`)
    }

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.tasklists).toHaveLength(10)
  })

  it('should handle many knowledge domains', () => {
    const pkg = { name: 'space' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    for (let i = 0; i < 15; i++) {
      appFS.writeFile(getTestPath(`knowledge/domain${i}/index.md`), `---\nlabel: "Domain${i}"\n---`)
    }

    const { result } = renderHook(() => useSpace(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.domains).toHaveLength(15)
  })
})
