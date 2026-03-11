// src/lib/fs/events.ts

export type FSEventType = 'create' | 'update' | 'delete' | 'rename'

export interface FSEvent {
  type: FSEventType
  path: string // full path in the FS scope that emits
  oldPath?: string // populated on 'rename'
  content?: string // populated on 'create' | 'update'
  timestamp: number
}

export type DirEventType = 'add' | 'remove' | 'rename'

export interface DirEvent {
  type: DirEventType
  dir: string // the watched directory (no trailing slash)
  entry: string // immediate child name that changed
  oldEntry?: string // populated on 'rename'
  content?: string // populated on 'add'
}

export interface BatchEvent {
  events: FSEvent[]
}
