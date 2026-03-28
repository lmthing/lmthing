import { create } from 'zustand'
import type { FileTreeNode } from './runtime/file-watcher'

interface IdeState {
  // File tree
  fileTree: FileTreeNode[]
  setFileTree: (tree: FileTreeNode[]) => void

  // Editor
  openFiles: string[]
  activeFile: string | null
  fileContents: Record<string, string>
  openFile: (path: string, content: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void

  // Preview
  previewUrl: string | null
  setPreviewUrl: (url: string | null) => void

  // Boot status
  isBooting: boolean
  isInstalling: boolean
  isRunning: boolean
  installComplete: boolean
  setBooting: (v: boolean) => void
  setInstalling: (v: boolean) => void
  setRunning: (v: boolean) => void
  setInstallComplete: (v: boolean) => void
}

export const useIdeStore = create<IdeState>((set) => ({
  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),

  openFiles: [],
  activeFile: null,
  fileContents: {},
  openFile: (path, content) =>
    set((s) => ({
      openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
      activeFile: path,
      fileContents: { ...s.fileContents, [path]: content },
    })),
  closeFile: (path) =>
    set((s) => {
      const openFiles = s.openFiles.filter((f) => f !== path)
      const { [path]: _, ...fileContents } = s.fileContents
      return {
        openFiles,
        activeFile: s.activeFile === path ? openFiles[0] || null : s.activeFile,
        fileContents,
      }
    }),
  setActiveFile: (path) => set({ activeFile: path }),
  updateFileContent: (path, content) =>
    set((s) => ({ fileContents: { ...s.fileContents, [path]: content } })),

  previewUrl: null,
  setPreviewUrl: (url) => set({ previewUrl: url }),

  isBooting: false,
  isInstalling: false,
  isRunning: false,
  installComplete: false,
  setBooting: (v) => set({ isBooting: v }),
  setInstalling: (v) => set({ isInstalling: v }),
  setRunning: (v) => set({ isRunning: v }),
  setInstallComplete: (v) => set({ installComplete: v }),
}))
