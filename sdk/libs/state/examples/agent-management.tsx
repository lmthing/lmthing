// examples/agent-management.tsx
//
// Demonstrates agent management functionality

import { useState } from 'react'
import {
  useAgentList,
  useAgent,
  useSpaceFS,
  P
} from '@lmthing/state'

function AgentList({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId: string | null }) {
  const agents = useAgentList()

  return (
    <div>
      <h2>Agents</h2>
      <ul>
        {agents.map((agent) => (
          <li key={agent.id}>
            <button
              onClick={() => onSelect(agent.id)}
              style={{ fontWeight: agent.id === selectedId ? 'bold' : 'normal' }}
            >
              {agent.id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AgentEditor({ agentId }: { agentId: string }) {
  const { instruct, config, values } = useAgent(agentId)
  const fs = useSpaceFS()
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = () => {
    const newName = prompt('Agent name:', instruct?.name || '')
    if (newName) {
      const updated = {
        ...instruct,
        name: newName
      }
      fs.writeFile(P.instruct(agentId), serializeAgentInstruct(updated))
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (confirm(`Delete agent ${agentId}?`)) {
      fs.deletePath(P.agent(agentId))
    }
  }

  if (!instruct) {
    return <p>Loading agent...</p>
  }

  return (
    <div>
      <h3>{instruct.name || 'Untitled Agent'}</h3>

      {instruct.description && (
        <p><strong>Description:</strong> {instruct.description}</p>
      )}

      {instruct.model && (
        <p><strong>Model:</strong> {instruct.model}</p>
      )}

      {config?.temperature !== undefined && (
        <p><strong>Temperature:</strong> {config.temperature}</p>
      )}

      <div style={{ marginTop: '1rem' }}>
        <h4>Instructions</h4>
        <pre style={{ background: '#f5f5f5', padding: '1rem' }}>
          {instruct.instructions}
        </pre>
      </div>

      {values && Object.keys(values).length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Runtime Values</h4>
          <dl>
            {Object.entries(values).map(([key, value]) => (
              <React.Fragment key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
        <button onClick={handleDelete} style={{ marginLeft: '0.5rem' }}>
          Delete Agent
        </button>
      </div>

      {isEditing && (
        <AgentForm agentId={agentId} instruct={instruct} onSave={handleSave} />
      )}
    </div>
  )
}

function AgentForm({
  agentId,
  instruct,
  onSave
}: {
  agentId: string
  instruct: any
  onSave: () => void
}) {
  const fs = useSpaceFS()
  const [name, setName] = useState(instruct.name || '')
  const [description, setDescription] = useState(instruct.description || '')
  const [instructions, setInstructions] = useState(instruct.instructions || '')

  const handleSubmit = () => {
    const updated = {
      ...instruct,
      name,
      description,
      instructions
    }
    fs.writeFile(P.instruct(agentId), serializeAgentInstruct(updated))
    onSave()
  }

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
      <h4>Edit Agent</h4>
      <div>
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label>Description:</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label>Instructions:</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={10}
          style={{ width: '100%' }}
        />
      </div>
      <button onClick={handleSubmit}>Save</button>
    </div>
  )
}

function CreateAgent({ onCreate }: { onCreate: (id: string) => void }) {
  const fs = useSpaceFS()
  const [name, setName] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return

    const id = name.toLowerCase().replace(/\s+/g, '-')
    const instruct = {
      name,
      instructions: `You are ${name}.`,
      createdAt: new Date().toISOString()
    }

    fs.writeFile(P.instruct(id), serializeAgentInstruct(instruct))
    fs.writeFile(P.agentConfig(id), JSON.stringify({ enabled: true }, null, 2))
    fs.writeFile(P.agentValues(id), JSON.stringify({}, null, 2))

    onCreate(id)
    setName('')
  }

  return (
    <div>
      <input
        placeholder="Agent name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleCreate}>Create Agent</button>
    </div>
  )
}

function serializeAgentInstruct(instruct: any): string {
  const frontmatter = Object.entries(instruct)
    .filter(([_, v]) => v !== undefined && _ !== 'instructions')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')

  return `---\n${frontmatter}\n---\n${instruct.instructions || ''}`
}

export function AgentManagement() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div>
        <CreateAgent onCreate={setSelectedId} />
        <AgentList onSelect={setSelectedId} selectedId={selectedId} />
      </div>
      <div style={{ flex: 1 }}>
        {selectedId ? (
          <AgentEditor agentId={selectedId} />
        ) : (
          <p>Select an agent to view details</p>
        )}
      </div>
    </div>
  )
}
