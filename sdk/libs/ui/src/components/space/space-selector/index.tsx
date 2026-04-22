import { useCallback, useMemo } from 'react'
import { useUIState, useToggle } from '@lmthing/state'
import { ChevronDown, Plus, Search, FolderOpen, Github } from 'lucide-react'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/components/space/index.css'

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

export function SpaceSelector({ spaces, currentSpaceId, onSelectSpace, onCreateSpace }: SpaceSelectorProps) {
  const [isOpen, toggleIsOpen, setIsOpen] = useToggle('space-selector.is-open', false)
  const [searchQuery, setSearchQuery] = useUIState('space-selector.search-query', '')
  const [showCreate, , setShowCreate] = useToggle('space-selector.show-create', false)
  const [newSpaceName, setNewSpaceName] = useUIState('space-selector.new-space-name', '')

  const currentSpace = useMemo(() => spaces.find(s => s.id === currentSpaceId), [spaces, currentSpaceId])
  const filteredSpaces = useMemo(() => spaces.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())), [spaces, searchQuery])

  const handleSelect = useCallback((spaceId: string) => { onSelectSpace?.(spaceId); setIsOpen(false); setSearchQuery('') }, [onSelectSpace])
  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (newSpaceName.trim()) { onCreateSpace?.(newSpaceName.trim()); setNewSpaceName(''); setShowCreate(false); setIsOpen(false) }
  }, [newSpaceName, onCreateSpace])

  return (
    <div className="space-selector">
      <Button onClick={toggleIsOpen} variant="ghost" className="space-selector__trigger">
        <Label className="space-selector__trigger-label">
          {currentSpace ? currentSpace.name : 'Select Space'}
        </Label>
        <ChevronDown className="space-selector__chevron" />
      </Button>

      {isOpen && (
        <div className="dropdown__content space-selector__dropdown">
          <div className="space-selector__search-section">
            <div className="space-selector__search-wrapper">
              <Search className="space-selector__search-icon" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search spaces..."
                className="input--sm space-selector__search-input"
                autoFocus
              />
            </div>
          </div>

          <div className="space-selector__list">
            {filteredSpaces.length === 0 ? (
              <Caption muted className="space-selector__empty">No spaces found</Caption>
            ) : (
              filteredSpaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => handleSelect(space.id)}
                  className={`dropdown__item space-selector__item ${space.id === currentSpaceId ? 'list-item--selected' : ''}`}
                >
                  {space.isLocal ? (
                    <FolderOpen className="space-selector__item-icon" />
                  ) : space.ownerAvatarUrl ? (
                    <img src={space.ownerAvatarUrl} alt="" className="space-selector__avatar" />
                  ) : (
                    <Github className="space-selector__item-icon" />
                  )}
                  <span className="space-selector__item-name">{space.name}</span>
                </button>
              ))
            )}
          </div>

          <div className="space-selector__footer">
            {showCreate ? (
              <form onSubmit={handleCreate}>
                <Stack gap="sm" className="space-selector__create-form">
                  <Input type="text" value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="Space name..." className="input--sm" autoFocus />
                  <Stack row gap="sm">
                    <Button type="submit" variant="primary" size="sm" className="space-selector__create-btn">Create</Button>
                    <Button type="button" onClick={() => setShowCreate(false)} variant="ghost" size="sm" className="space-selector__create-btn">Cancel</Button>
                  </Stack>
                </Stack>
              </form>
            ) : (
              <button onClick={() => setShowCreate(true)} className="dropdown__item space-selector__new-btn">
                <Plus className="space-selector__new-icon" /><span>New Space</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
