import type { WebContainer } from '@webcontainer/api'
import type { FileSystemTree } from './template'

const SNAPSHOT_DIR = 'lmthing-wc'

export async function hasSnapshot(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(SNAPSHOT_DIR)
    for await (const _ of dir.values()) return true
    return false
  } catch {
    return false
  }
}

async function readOPFSDir(dir: FileSystemDirectoryHandle): Promise<FileSystemTree> {
  const tree: FileSystemTree = {}
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') {
      tree[name] = { directory: await readOPFSDir(handle as FileSystemDirectoryHandle) }
    } else {
      const file = await (handle as FileSystemFileHandle).getFile()
      const buf = await file.arrayBuffer()
      tree[name] = { file: { contents: new Uint8Array(buf) as unknown as string } }
    }
  }
  return tree
}

export async function restoreSnapshot(container: WebContainer): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle(SNAPSHOT_DIR)
  const tree = await readOPFSDir(dir)
  await container.mount(tree as any)
}

async function writeWCDir(
  container: WebContainer,
  wcPath: string,
  opfsDir: FileSystemDirectoryHandle,
): Promise<void> {
  const entries = await container.fs.readdir(wcPath, { withFileTypes: true })
  for (const entry of entries) {
    const childPath = wcPath === '.' ? entry.name : `${wcPath}/${entry.name}`
    if (entry.isDirectory()) {
      const childDir = await opfsDir.getDirectoryHandle(entry.name, { create: true })
      await writeWCDir(container, childPath, childDir)
    } else {
      try {
        const contents = await container.fs.readFile(childPath)
        const fileHandle = await opfsDir.getFileHandle(entry.name, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(contents)
        await writable.close()
      } catch {
        // Skip unreadable files (e.g. sockets, special files)
      }
    }
  }
}

export async function saveSnapshot(container: WebContainer): Promise<void> {
  const root = await navigator.storage.getDirectory()
  // Clear first so deleted files don't accumulate across sessions
  try { await root.removeEntry(SNAPSHOT_DIR, { recursive: true }) } catch { /* didn't exist */ }
  const dir = await root.getDirectoryHandle(SNAPSHOT_DIR, { create: true })
  await writeWCDir(container, '.', dir)
}
