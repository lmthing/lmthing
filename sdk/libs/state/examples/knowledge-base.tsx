// examples/knowledge-base.tsx
//
// Demonstrates knowledge base functionality

import { useState } from 'react'
import {
  useDomainDirectory,
  useKnowledge,
  useKnowledgeFile,
  useSpaceFS,
  P
} from '@lmthing/state'

function DomainList({ onSelect, selectedDir }: { onSelect: (dir: string) => void; selectedDir: string | null }) {
  const domains = useDomainDirectory()

  return (
    <div>
      <h2>Knowledge Domains</h2>
      <ul>
        {domains.map((domain) => (
          <li key={domain.id}>
            <button
              onClick={() => onSelect(domain.id)}
              style={{ fontWeight: domain.id === selectedDir ? 'bold' : 'normal' }}
            >
              {domain.id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DomainViewer({ domain }: { domain: string }) {
  const { config, entries } = useKnowledge(domain)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const content = useKnowledgeFile(selectedFile || `${domain}/README`) || null

  const handleCreateFile = () => {
    const name = prompt('File name (without extension):')
    if (!name) return

    const fs = useSpaceFS()
    fs.writeFile(P.knowledgeFile(`${domain}/${name}`), '# New Document\n')
  }

  const handleDeleteFile = (fileName: string) => {
    if (confirm(`Delete ${fileName}?`)) {
      const fs = useSpaceFS()
      fs.deleteFile(P.knowledgeFile(`${domain}/${fileName}`))
    }
  }

  return (
    <div>
      <h3>{config?.title || domain}</h3>

      {config?.description && (
        <p><strong>Description:</strong> {config.description}</p>
      )}

      {config?.tags && config.tags.length > 0 && (
        <p>
          <strong>Tags:</strong>{' '}
          {config.tags.map((tag) => (
            <span key={tag} style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', background: '#e0e0e0', borderRadius: '4px' }}>
              {tag}
            </span>
          ))}
        </p>
      )}

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>Documents</h4>
          <button onClick={handleCreateFile}>+ Add Document</button>
        </div>

        <ul>
          {entries.map((entry) => (
            entry.type === 'file' ? (
              <li key={entry.path}>
                <button
                  onClick={() => setSelectedFile(entry.name.replace('.md', ''))}
                  style={{ fontWeight: selectedFile === entry.name.replace('.md', '') ? 'bold' : 'normal' }}
                >
                  {entry.name.replace('.md', '')}
                </button>
                <button
                  onClick={() => handleDeleteFile(entry.name.replace('.md', ''))}
                  style={{ marginLeft: '1rem', fontSize: '0.8em' }}
                >
                  Delete
                </button>
              </li>
            ) : null
          ))}
        </ul>
      </div>

      {content && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Document Content</h4>
          <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{content}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateDomain({ onCreate }: { onCreate: (id: string) => void }) {
  const fs = useSpaceFS()
  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    if (!id.trim()) return

    const config = {
      title: title || id,
      description,
      createdAt: new Date().toISOString()
    }

    // Create directory structure
    fs.writeFile(P.knowledgeConfig(id), JSON.stringify(config, null, 2))
    fs.writeFile(P.knowledgeFile(`${id}/README`), `# ${title || id}\n\n${description}`)

    onCreate(id)
    setId('')
    setTitle('')
    setDescription('')
  }

  return (
    <div>
      <h4>Create New Domain</h4>
      <input
        placeholder="Domain ID (e.g., engineering, docs)"
        value={id}
        onChange={(e) => setId(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />
      <input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />
      <button onClick={handleCreate}>Create Domain</button>
    </div>
  )
}

function SearchBar({ onResults }: { onResults: (results: string[]) => void }) {
  const [query, setQuery] = useState('')
  const fs = useSpaceFS()

  const handleSearch = () => {
    if (!query.trim()) {
      onResults([])
      return
    }

    // Simple text search across all knowledge files
    const allFiles = fs.globRead('**/*.md')
    const results: string[] = []

    for (const [path, content] of Object.entries(allFiles)) {
      if (path.startsWith('knowledge/') && content.toLowerCase().includes(query.toLowerCase())) {
        results.push(path.replace('knowledge/', '').replace('.md', ''))
      }
    }

    onResults(results)
  }

  return (
    <div>
      <input
        placeholder="Search knowledge base..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button onClick={handleSearch}>Search</button>
    </div>
  )
}

export function KnowledgeBase() {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<string[]>([])

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div>
        <SearchBar onResults={(results) => {
          if (results.length > 0) {
            setSelectedDomain(results[0].split('/')[0])
          }
        }} />
        <CreateDomain onCreate={setSelectedDomain} />
        <DomainList onSelect={setSelectedDomain} selectedDir={selectedDomain} />
      </div>
      <div style={{ flex: 1 }}>
        {selectedDomain ? (
          <DomainViewer domain={selectedDomain} />
        ) : (
          <p>Select a domain to view knowledge</p>
        )}
      </div>
    </div>
  )
}
