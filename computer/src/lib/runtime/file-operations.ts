import type { WebContainer } from '@webcontainer/api'

export async function writeFile(container: WebContainer, path: string, content: string): Promise<void> {
  await container.fs.writeFile(path, content)
}

export async function readFile(container: WebContainer, path: string): Promise<string> {
  return container.fs.readFile(path, 'utf-8')
}

export async function createFile(container: WebContainer, path: string, content = ''): Promise<void> {
  await container.fs.writeFile(path, content)
}

export async function createDirectory(container: WebContainer, path: string): Promise<void> {
  await container.fs.mkdir(path, { recursive: true })
}

export async function deleteFile(container: WebContainer, path: string): Promise<void> {
  await container.fs.rm(path, { recursive: true })
}

export async function renameFile(container: WebContainer, oldPath: string, newPath: string): Promise<void> {
  const content = await container.fs.readFile(oldPath, 'utf-8')
  await container.fs.writeFile(newPath, content)
  await container.fs.rm(oldPath)
}
