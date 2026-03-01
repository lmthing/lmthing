import { useMemo } from 'react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'

/**
 * Hook to access package.json data from the workspace state
 */
export function usePackageJson() {
  const { packageJson, isLoading, error } = useWorkspaceData()

  const dependencies = useMemo(() => {
    return packageJson?.dependencies || {}
  }, [packageJson])

  const devDependencies = useMemo(() => {
    return packageJson?.devDependencies || {}
  }, [packageJson])

  const allDependencies = useMemo(() => {
    return { ...dependencies, ...devDependencies }
  }, [dependencies, devDependencies])

  const dependencyList = useMemo(() => {
    return Object.entries(allDependencies).map(([name, version]) => ({
      name,
      version,
    }))
  }, [allDependencies])

  return {
    packageJson: packageJson || null,
    dependencies,
    devDependencies,
    allDependencies,
    dependencyList,
    isLoading,
    error,

    // Helper methods
    hasDependency: (name: string) => name in allDependencies,
    getDependencyVersion: (name: string) => allDependencies[name],
    dependencyCount: dependencyList.length,
  }
}
