// examples/workflow-editor.tsx
//
// Demonstrates workflow management functionality

import { useState } from 'react'
import {
  useFlowList,
  useWorkFlow,
  useFlowTask,
  useSpaceFS,
  P
} from '@lmthing/state'

function WorkflowList({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId: string | null }) {
  const flows = useFlowList()

  return (
    <div>
      <h2>Workflows</h2>
      <ul>
        {flows.map((flow) => (
          <li key={flow.id}>
            <button
              onClick={() => onSelect(flow.id)}
              style={{ fontWeight: flow.id === selectedId ? 'bold' : 'normal' }}
            >
              {flow.id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WorkflowEditor({ flowId }: { flowId: string }) {
  const { index, tasks } = useWorkFlow(flowId)
  const fs = useSpaceFS()

  const handleCreateTask = () => {
    const name = prompt('Task name:')
    if (!name) return

    const order = tasks.length + 1
    const task = {
      name,
      content: `# ${name}\n\nTask instructions go here.`
    }
    fs.writeFile(P.flowTask(flowId, order, name), serializeFlowTask(task))
  }

  const handleDeleteTask = (taskName: string) => {
    if (confirm(`Delete task ${taskName}?`)) {
      // Find and delete the task file
      const task = tasks.find(t => t.name === taskName)
      if (task) {
        fs.deleteFile(task.path)
      }
    }
  }

  if (!index) {
    return <p>Loading workflow...</p>
  }

  return (
    <div>
      <h3>{index.name || 'Untitled Workflow'}</h3>

      {index.description && (
        <p><strong>Description:</strong> {index.description}</p>
      )}

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>Tasks</h4>
          <button onClick={handleCreateTask}>+ Add Task</button>
        </div>

        <ul>
          {tasks
            .sort((a, b) => a.order - b.order)
            .map((task) => (
              <li key={task.path}>
                <span>{task.order}. {task.name}</span>
                <button
                  onClick={() => handleDeleteTask(task.name)}
                  style={{ marginLeft: '1rem' }}
                >
                  Delete
                </button>
              </li>
            ))}
        </ul>
      </div>

      {tasks.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Task Preview</h4>
          <TaskPreview flowId={flowId} task={tasks[0]} />
        </div>
      )}
    </div>
  )
}

function TaskPreview({ flowId, task }: { flowId: string; task: { order: number; name: string } }) {
  const taskData = useFlowTask(flowId, task.order, task.name)

  if (!taskData) {
    return <p>Select a task to preview</p>
  }

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5' }}>
      <h5>{taskData.name}</h5>

      {taskData.description && (
        <p><strong>Description:</strong> {taskData.description}</p>
      )}

      {taskData.agent && (
        <p><strong>Agent:</strong> {taskData.agent}</p>
      )}

      <div style={{ marginTop: '0.5rem' }}>
        <strong>Content:</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
          {taskData.content}
        </pre>
      </div>
    </div>
  )
}

function CreateWorkflow({ onCreate }: { onCreate: (id: string) => void }) {
  const fs = useSpaceFS()
  const [name, setName] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return

    const id = name.toLowerCase().replace(/\s+/g, '-')
    const index = {
      name,
      tasks: []
    }

    fs.writeFile(P.flowIndex(id), serializeFlowIndex(index))
    onCreate(id)
    setName('')
  }

  return (
    <div>
      <input
        placeholder="Workflow name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleCreate}>Create Workflow</button>
    </div>
  )
}

function serializeFlowIndex(index: any): string {
  const frontmatter = [
    `name: ${JSON.stringify(index.name)}`,
    index.description && `description: ${JSON.stringify(index.description)}`
  ].filter(Boolean).join('\n')

  return `---\n${frontmatter}\n---\n`
}

function serializeFlowTask(task: any): string {
  const frontmatter = [
    `name: ${JSON.stringify(task.name)}`,
    task.description && `description: ${JSON.stringify(task.description)}`,
    task.agent && `agent: ${JSON.stringify(task.agent)}`
  ].filter(Boolean).join('\n')

  return `---\n${frontmatter}\n---\n${task.content || ''}`
}

export function WorkflowEditor() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div>
        <CreateWorkflow onCreate={setSelectedId} />
        <WorkflowList onSelect={setSelectedId} selectedId={selectedId} />
      </div>
      <div style={{ flex: 1 }}>
        {selectedId ? (
          <WorkflowEditor flowId={selectedId} />
        ) : (
          <p>Select a workflow to view details</p>
        )}
      </div>
    </div>
  )
}
