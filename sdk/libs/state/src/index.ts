// LMThing FS Architecture - Main Entry Point

// Types
export * from './types'

// Core FS + Pod transport
export * from './lib/fs'
export * from './lib/pod'
export * from './lib/contexts'

// Hooks
export * from './hooks'

// Re-export commonly used names
export { AppProvider } from './lib/contexts/AppContext'
export type { AppPodConfig, ProjectSummary } from './lib/contexts/AppContext'
export { ProjectProvider, useProject } from './lib/contexts/ProjectContext'
export { SpaceProvider } from './lib/contexts/SpaceContext'
