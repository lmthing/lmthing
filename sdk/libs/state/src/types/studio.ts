// src/types/studio.ts

export type FileTree = Record<string, string> // filePath → raw string content

export interface SpaceConfig {
  name: string
  description?: string
  tags?: string[]
  system?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface StudioSettings {
  theme?: 'light' | 'dark' | 'system'
  [key: string]: unknown
}

export interface StudioConfig {
  id: string
  name: string
  version?: string
  spaces: Record<string, SpaceConfig> // spaceId → config
  settings?: StudioSettings
}

export interface StudioData {
  id: string
  username: string
  config: StudioConfig
}

export interface AppData {
  studios: Record<string, StudioData> // key: "{username}/{studioId}"
  currentStudioKey: string | null
  currentSpaceId: string | null
}

export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

export type FileOp =
  | { type: 'write'; path: string; content: string }
  | { type: 'append'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'duplicate'; source: string; dest: string }

export type Unsubscribe = () => void
