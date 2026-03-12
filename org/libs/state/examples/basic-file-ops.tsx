// examples/basic-file-ops.tsx
//
// Demonstrates basic file system operations

import { useSpaceFS, useFile, useDir } from '@lmthing/state'

function FileList() {
  const fs = useSpaceFS()
  const files = useDir('')

  const handleDelete = (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      fs.deleteFile(path)
    }
  }

  const handleRename = (oldPath: string) => {
    const newPath = prompt('New name:', oldPath)
    if (newPath && newPath !== oldPath) {
      fs.renamePath(oldPath, newPath)
    }
  }

  return (
    <ul>
      {files.map((file) => (
        <li key={file.path}>
          <span>{file.name}</span>
          <button onClick={() => handleRename(file.path)}>Rename</button>
          <button onClick={() => handleDelete(file.path)}>Delete</button>
        </li>
      ))}
    </ul>
  )
}

function FileEditor({ path }: { path: string }) {
  const content = useFile(path) || ''
  const fs = useSpaceFS()

  const handleChange = (value: string) => {
    fs.writeFile(path, value)
  }

  return (
    <textarea
      value={content}
      onChange={(e) => handleChange(e.target.value)}
      rows={20}
      style={{ width: '100%', fontFamily: 'monospace' }}
    />
  )
}

function CreateFile() {
  const fs = useSpaceFS()

  const handleCreate = () => {
    const name = prompt('File name:')
    if (name) {
      fs.writeFile(name, '')
    }
  }

  return <button onClick={handleCreate}>New File</button>
}

function CreateDirectory() {
  const fs = useSpaceFS()

  const handleCreate = () => {
    const name = prompt('Directory name:')
    if (name) {
      // Create a placeholder file in the directory
      fs.writeFile(`${name}/.gitkeep`, '')
    }
  }

  return <button onClick={handleCreate}>New Directory</button>
}

export function BasicFileOps() {
  return (
    <div>
      <h1>File Operations</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <CreateFile />
        <CreateDirectory />
      </div>
      <FileList />
      <hr />
      <FileEditor path="readme.md" />
    </div>
  )
}
