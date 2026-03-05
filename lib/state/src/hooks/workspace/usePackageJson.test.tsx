// src/hooks/workspace/usePackageJson.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '@/lib/contexts/AppContext'
import { StudioProvider } from '@/lib/contexts/StudioContext'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { AppFS } from '@/lib/fs/AppFS'
import { usePackageJson } from './usePackageJson'

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

    appFS.writeFile('alice/test/space1/package.json', JSON.stringify(pkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('my-space')
    expect(result.current?.version).toBe('1.0.0')
    expect(result.current?.private).toBe(true)
    expect(result.current?.dependencies?.['some-package']).toBe('^1.0.0')
  })

  it('should return null for non-existent package.json', () => {
    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    appFS.writeFile('alice/test/space1/package.json', 'not json')

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
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

    appFS.writeFile('alice/test/space1/package.json', JSON.stringify(pkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.description).toBe('Test package')
    expect(result.current?.devDependencies?.['dev1']).toBe('^2.0.0')
  })

  it('should handle minimal package.json', () => {
    appFS.writeFile('alice/test/space1/package.json', JSON.stringify({ name: 'minimal' }))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.name).toBe('minimal')
    expect(result.current?.version).toBeUndefined()
  })

  it('should re-render when package.json is updated', async () => {
    const initialPkg = { name: 'original', version: '1.0.0' }
    appFS.writeFile('alice/test/space1/package.json', JSON.stringify(initialPkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.version).toBe('1.0.0')

    const updatedPkg = { name: 'original', version: '2.0.0' }
    appFS.writeFile('alice/test/space1/package.json', JSON.stringify(updatedPkg))

    await waitFor(() => {
      expect(result.current?.version).toBe('2.0.0')
    })
  })

  it('should re-render when package.json is created', async () => {
    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const pkg = { name: 'new' }
    appFS.writeFile('alice/test/space1/package.json', JSON.stringify(pkg))

    await waitFor(() => {
      expect(result.current?.name).toBe('new')
    })
  })

  it('should re-render when package.json is deleted', async () => {
    const pkg = { name: 'test' }
    appFS.writeFile('alice/test/space1/package.json', JSON.stringify(pkg))

    const { result } = renderHook(() => usePackageJson(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/package.json')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when unrelated files change', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/package.json', JSON.stringify({ name: 'test' }))

    const { result } = renderHook(() => {
      renderCount++
      return usePackageJson()
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/other.txt', 'content')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
