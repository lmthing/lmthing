import { useState, useCallback, useMemo } from 'react'
import { ChevronDown, Plus, Search, FolderOpen, Github } from 'lucide-react'

export interface SpaceEntry {
  id: string
  name: string
  description?: string
  isLocal?: boolean
  ownerAvatarUrl?: string
}

interface SpaceSelectorProps {
  spaces: SpaceEntry[]
  currentSpaceId?: string | null
  onSelectSpace?: (spaceId: string) => void
  onCreateSpace?: (name: string) => void
}

export function SpaceSelector({
  spaces,
  currentSpaceId,
  onSelectSpace,
  onCreateSpace,
}: SpaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')

  const currentSpace = useMemo(
    () => spaces.find(s => s.id === currentSpaceId),
    [spaces, currentSpaceId]
  )

  const filteredSpaces = useMemo(
    () => spaces.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [spaces, searchQuery]
  )

  const handleSelect = useCallback((spaceId: string) => {
    onSelectSpace?.(spaceId)
    setIsOpen(false)
    setSearchQuery('')
  }, [onSelectSpace])

  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (newSpaceName.trim()) {
      onCreateSpace?.(newSpaceName.trim())
      setNewSpaceName('')
      setShowCreate(false)
      setIsOpen(false)
    }
  }, [newSpaceName, onCreateSpace])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn--ghost"
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentSpace ? currentSpace.name : 'Select Space'}
        </span>
        <ChevronDown className="w-4 h-4" style={{ flexShrink: 0, opacity: 0.5 }} />
      </button>

      {isOpen && (
        <div className="dropdown__content" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '0.25rem' }}>
          {/* Search */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ position: 'relative' }}>
              <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search spaces..."
                className="input input--sm"
                style={{ paddingLeft: '2rem' }}
                autoFocus
              />
            </div>
          </div>

          {/* Space List */}
          <div style={{ maxHeight: '16rem', overflowY: 'auto' }}>
            {filteredSpaces.length === 0 ? (
              <div className="caption caption--muted" style={{ padding: '1rem', textAlign: 'center' }}>
                No spaces found
              </div>
            ) : (
              filteredSpaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => handleSelect(space.id)}
                  className={`dropdown__item ${space.id === currentSpaceId ? 'list-item--selected' : ''}`}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  {space.isLocal ? (
                    <FolderOpen className="w-4 h-4" style={{ flexShrink: 0, opacity: 0.6 }} />
                  ) : (
                    space.ownerAvatarUrl ? (
                      <img src={space.ownerAvatarUrl} alt="" style={{ width: '1rem', height: '1rem', borderRadius: '9999px', flexShrink: 0 }} />
                    ) : (
                      <Github className="w-4 h-4" style={{ flexShrink: 0, opacity: 0.6 }} />
                    )
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {space.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Create */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '0.5rem' }}>
            {showCreate ? (
              <form onSubmit={handleCreate} className="stack stack--gap-sm" style={{ padding: '0.25rem' }}>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Space name..."
                  className="input input--sm"
                  autoFocus
                />
                <div className="stack stack--row stack--gap-sm">
                  <button type="submit" className="btn btn--primary btn--sm" style={{ flex: 1 }}>Create</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn btn--ghost btn--sm" style={{ flex: 1 }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="dropdown__item"
                style={{ width: '100%' }}
              >
                <Plus className="w-4 h-4" />
                <span>New Space</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
