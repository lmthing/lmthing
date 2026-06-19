// examples/workflow-editor.tsx
//
// Demonstrates tasklist management functionality (the new-spec replacement for
// the old flows/ shape).

import { useState } from 'react'
import {
  useTasklistList,
  useTasklist,
  useTasklistTask,
  useSpaceFS,
  P,
} from '@lmthing/state'

function TasklistList({ onSelect, selectedName }: { onSelect: (name: string) => void; selectedName: string | null }) {
  const tasklists = useTasklistList()

  return (
    <div>
      <h2>Tasklists</h2>
      <ul>
        {tasklists.map((tl) => (
          <li key={tl.name}>
            <button
              onClick={() => onSelect(tl.name)}
              style={{ fontWeight: tl.name === selectedName ? 'bold' : 'normal' }}
            >
              {tl.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TasklistEditor({ name }: { name: string }) {
  const { tasks } = useTasklist(name)
  const fs = useSpaceFS()

  const handleCreateTask = () => {
    const id = prompt('Task id (kebab-case):')
    if (!id) return

    const order = tasks.length + 1
    fs.writeFile(
      P.tasklistTask(name, order, id),
      serializeTask({ id, instruction: `${id} instructions go here.` }),
    )
  }

  const handleDeleteTask = (path: string) => {
    if (confirm('Delete this task?')) {
      fs.deleteFile(path)
    }
  }

  return (
    <div>
      <h3>{name}</h3>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>Tasks</h4>
          <button onClick={handleCreateTask}>+ Add Task</button>
        </div>

        <ul>
          {tasks.map((task) => (
            <li key={task.path}>
              <span>{task.order}. {task.id}</span>
              <button onClick={() => handleDeleteTask(task.path)} style={{ marginLeft: '1rem' }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      {tasks.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Task Preview</h4>
          <TaskPreview path={tasks[0].path} />
        </div>
      )}
    </div>
  )
}

function TaskPreview({ path }: { path: string }) {
  const task = useTasklistTask(path)

  if (!task) {
    return <p>Select a task to preview</p>
  }

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5' }}>
      <h5>{task.id}</h5>

      <div style={{ marginTop: '0.5rem' }}>
        <strong>Instruction:</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
          {task.instruction}
        </pre>
      </div>
    </div>
  )
}

function CreateTasklist({ onCreate }: { onCreate: (name: string) => void }) {
  const fs = useSpaceFS()
  const [name, setName] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return

    const tasklistName = name.toLowerCase().replace(/\s+/g, '_')
    // Seed the tasklist with a first task so it shows up in listings.
    fs.writeFile(
      P.tasklistTask(tasklistName, 1, 'start'),
      serializeTask({ id: 'start', instruction: 'First step.' }),
    )
    onCreate(tasklistName)
    setName('')
  }

  return (
    <div>
      <input
        placeholder="Tasklist name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleCreate}>Create Tasklist</button>
    </div>
  )
}

function serializeTask(task: { id: string; instruction: string }): string {
  return [
    '---',
    `id: ${task.id}`,
    'output:',
    '  result: string',
    'dependsOn: []',
    'optional: false',
    'goal: false',
    '---',
    '',
    task.instruction,
  ].join('\n')
}

export function WorkflowEditor() {
  const [selectedName, setSelectedName] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div>
        <CreateTasklist onCreate={setSelectedName} />
        <TasklistList onSelect={setSelectedName} selectedName={selectedName} />
      </div>
      <div style={{ flex: 1 }}>
        {selectedName ? (
          <TasklistEditor name={selectedName} />
        ) : (
          <p>Select a tasklist to view details</p>
        )}
      </div>
    </div>
  )
}
