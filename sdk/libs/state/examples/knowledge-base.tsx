// examples/knowledge-base.tsx
//
// Demonstrates knowledge base functionality on the new spec, where each domain
// is described by a knowledge/<domain>/index.md (frontmatter: label/icon/color)
// and fields live under knowledge/<domain>/<field>/ with their own index.md and
// option markdown files.

import { useState } from 'react'
import {
  useDomainDirectory,
  useKnowledgeDir,
  useKnowledgeFile,
  useSpaceFS,
  P,
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
  const entries = useKnowledgeDir(domain)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const fs = useSpaceFS()

  // index.md is the domain descriptor; everything else is a field directory.
  const content = useKnowledgeFile(selectedFile ? `${domain}/${selectedFile}` : `${domain}/index`) || null

  const handleCreateField = () => {
    const field = prompt('Field name (kebab-case):')
    if (!field) return
    fs.writeFile(
      P.knowledgeFieldIndex(domain, field),
      ['---', 'type: string', `variable: ${field.replace(/-/g, '')}`, '---', '', `${field} field.`].join('\n'),
    )
  }

  const handleDeleteField = (fieldName: string) => {
    if (confirm(`Delete ${fieldName}?`)) {
      fs.deletePath(P.knowledgeFieldDir(domain, fieldName))
    }
  }

  return (
    <div>
      <h3>{domain}</h3>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>Fields</h4>
          <button onClick={handleCreateField}>+ Add Field</button>
        </div>

        <ul>
          {entries
            .filter((entry) => entry.type === 'dir')
            .map((entry) => (
              <li key={entry.path}>
                <button
                  onClick={() => setSelectedFile(`${entry.name}/index`)}
                  style={{ fontWeight: selectedFile === `${entry.name}/index` ? 'bold' : 'normal' }}
                >
                  {entry.name}
                </button>
                <button
                  onClick={() => handleDeleteField(entry.name)}
                  style={{ marginLeft: '1rem', fontSize: '0.8em' }}
                >
                  Delete
                </button>
              </li>
            ))}
        </ul>
      </div>

      {content && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Content</h4>
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
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    if (!id.trim()) return

    // New spec: the domain descriptor is knowledge/<domain>/index.md.
    fs.writeFile(
      P.knowledgeDomainIndex(id),
      [
        '---',
        `label: "${(label || id).replace(/"/g, '\\"')}"`,
        'renderAs: section',
        '---',
        '',
        description || `${label || id} knowledge.`,
      ].join('\n'),
    )

    onCreate(id)
    setId('')
    setLabel('')
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
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
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
