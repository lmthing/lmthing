// src/hooks/workspace/usePackageJson.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '../../lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '../../test-utils'
import { usePackageJson } from './usePackageJson'

describe('usePackageJson', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse package.json', () => {
    const pkg = {
      name: 'my-space',
      version: '1.0.0',
      private: true,
      dependencies: {
        'some-package': '^1.0.0'
      }
    }

    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS, { skipPackageJsonSetup: true })
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('my-space')
    expect(result.current?.version).toBe('1.0.0')
    expect(result.current?.private).toBe(true)
    expect(result.current?.dependencies?.['some-package']).toBe('^1.0.0')
  })

  it('should return null for non-existent package.json', () => {
    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS, { skipPackageJsonSetup: true })
    })

    expect(result.current).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    appFS.writeFile(getTestPath('package.json'), 'not json')

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS, { skipPackageJsonSetup: true })
    })

    expect(result.current).toBeNull()
  })

  it('should parse all common fields', () => {
    const pkg = {
      name: 'test',
      version: '2.0.0',
      description: 'Test package',
      private: true,
      dependencies: { dep1: '^1.0.0' },
      devDependencies: { dev1: '^2.0.0' }
    }

    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS, { skipPackageJsonSetup: true })
    })

    expect(result.current?.description).toBe('Test package')
    expect(result.current?.devDependencies?.['dev1']).toBe('^2.0.0')
  })

  it('should handle minimal package.json', () => {
    appFS.writeFile(getTestPath('package.json'), JSON.stringify({ name: 'minimal' }))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS, { skipPackageJsonSetup: true })
    })

    expect(result.current?.name).toBe('minimal')
    expect(result.current?.version).toBeUndefined()
  })

  it('should re-render when package.json is updated', async () => {
    const initialPkg = { name: 'original', version: '1.0.0' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(initialPkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current?.version).toBe('1.0.0')

    const updatedPkg = { name: 'original', version: '2.0.0' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(updatedPkg))

    await waitFor(() => {
      expect(result.current?.version).toBe('2.0.0')
    })
  })

  it('should re-render when package.json is created', async () => {
    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS, { skipPackageJsonSetup: true })
    })

    expect(result.current).toBeNull()

    const pkg = { name: 'new' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    await waitFor(() => {
      expect(result.current?.name).toBe('new')
    })
  })

  it('should re-render when package.json is deleted', async () => {
    const pkg = { name: 'test' }
    appFS.writeFile(getTestPath('package.json'), JSON.stringify(pkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('package.json'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when unrelated files change', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('package.json'), JSON.stringify({ name: 'test' }))

    const { result } = renderHook(() => {
      renderCount++
      return usePackageJson()
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile(getTestPath('other.txt'), 'content')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
