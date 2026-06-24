// Re-export the project-scoped hooks from @lmthing/state under the
// @lmthing/ui/hooks/project/* path for consumers that import via the ui lib.
// (Renamed from hooks/studio/* under the pod-backed architecture.)

export { useApp } from './useApp'
export { useProject } from './useProject'
export { useProjects } from './useProjects'
export { useProjectSpaces } from './useProjectSpaces'
export { useProjectConfig, useProjectConfigValue, useUpdateProjectConfig } from './useProjectConfig'
export { useProjectEnv, useProjectEnvWritable } from './useProjectEnv'
export { useProjectEnvList } from './useProjectEnvList'
