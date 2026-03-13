import type { WebContainer } from '@webcontainer/api'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export async function buildFileTree(container: WebContainer, path = '.'): Promise<FileTreeNode[]> {
  try {
    const entries = await container.fs.readdir(path, { withFileTypes: true })
    const nodes: FileTreeNode[] = []

    for (const entry of entries) {
      // Skip node_modules and hidden files
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue

      const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`

      if (entry.isDirectory()) {
        const children = await buildFileTree(container, fullPath)
        nodes.push({ name: entry.name, path: fullPath, type: 'directory', children })
      } else {
        nodes.push({ name: entry.name, path: fullPath, type: 'file' })
      }
    }

    return nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name)
      return a.type === 'directory' ? -1 : 1
    })
  } catch {
    return []
  }
}

export function watchFileSystem(
  container: WebContainer,
  onUpdate: (tree: FileTreeNode[]) => void,
  intervalMs = 3000,
): () => void {
  let active = true

  const poll = async () => {
    while (active) {
      try {
        const tree = await buildFileTree(container)
        if (active) onUpdate(tree)
      } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
  poll()

  return () => { active = false }
}
