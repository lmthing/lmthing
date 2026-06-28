/**
 * FunctionsEditor
 *
 * Reusable editor for the `functions/` directory of the active space.
 * Displays a list of `functions/<name>.ts` files discovered via the VFS,
 * and lets the user create, rename, delete, and edit their raw TypeScript
 * source in a code textarea — matching the same draft/save pattern used by
 * the agent-builder and topic-editor.
 */
import '@lmthing/css/components/functions/index.css'
import { useCallback, useEffect, useRef } from 'react'
import { useSpaceFS, useGlob, useFile, useUIState, P } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'

// ── helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_FUNCTION_TEMPLATE = `/**
 * Describe what this function does.
 */
export default function untitled(): void {
  // implementation
}
`

function functionNameFromPath(path: string): string {
  return path.split('/').pop()?.replace(/\.ts$/, '') ?? path
}

// ── FunctionListItem ──────────────────────────────────────────────────────────

interface FunctionListItemProps {
  name: string
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}

function FunctionListItem({ name, isActive, onSelect, onDelete, onRename }: FunctionListItemProps) {
  const [renaming, setRenaming] = useUIState(`fn-item.${name}.renaming`, false)
  const [renameValue, setRenameValue] = useUIState(`fn-item.${name}.rename-value`, name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setRenameValue(name)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [renaming, name, setRenameValue])

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim().replace(/\.ts$/, '')
    if (trimmed && trimmed !== name) onRename(trimmed)
    setRenaming(false)
  }, [renameValue, name, onRename, setRenaming])

  return (
    <div
      className={`functions-editor__list-item${isActive ? ' functions-editor__list-item--active' : ''}`}
      onClick={() => { if (!renaming) onSelect() }}
    >
      {renaming ? (
        <Input
          ref={inputRef}
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            if (e.key === 'Escape') setRenaming(false)
          }}
          onBlur={commitRename}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1 }}
        />
      ) : (
        <span className="functions-editor__list-item-name">{name}.ts</span>
      )}

      <div className="functions-editor__list-item-actions" onClick={e => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          title="Rename"
          onClick={() => setRenaming(true)}
        >
          ✎
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          onClick={onDelete}
        >
          ✕
        </Button>
      </div>
    </div>
  )
}

// ── FunctionCodeEditor ────────────────────────────────────────────────────────

interface FunctionCodeEditorProps {
  functionPath: string
}

function FunctionCodeEditor({ functionPath }: FunctionCodeEditorProps) {
  const spaceFS = useSpaceFS()
  const rawContent = useFile(functionPath)
  const name = functionNameFromPath(functionPath)

  const [draft, setDraft] = useUIState<string>(`fn-editor.${functionPath}.draft`, '')
  const [hasUnsaved, setHasUnsaved] = useUIState<boolean>(`fn-editor.${functionPath}.unsaved`, false)

  // Sync draft when file content changes (load / external update)
  const syncKey = `${functionPath}::${rawContent ?? ''}`
  const lastSyncKey = useRef('')
  useEffect(() => {
    if (lastSyncKey.current === syncKey) return
    lastSyncKey.current = syncKey
    if (rawContent !== null && rawContent !== undefined) {
      setDraft(rawContent)
      setHasUnsaved(false)
    }
  })

  const handleChange = useCallback((value: string) => {
    setDraft(value)
    setHasUnsaved(true)
  }, [setDraft, setHasUnsaved])

  const handleSave = useCallback(() => {
    if (!spaceFS || !hasUnsaved) return
    spaceFS.writeFile(functionPath, draft)
    setHasUnsaved(false)
  }, [spaceFS, functionPath, draft, hasUnsaved, setHasUnsaved])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  return (
    <div className="functions-editor__pane">
      <div className="functions-editor__pane-header">
        <Stack row gap="sm">
          <Label>{name}.ts</Label>
          <Caption muted>{functionPath}</Caption>
        </Stack>
        <Stack row gap="sm">
          {hasUnsaved && <Caption muted>Unsaved</Caption>}
          <Button
            variant="primary"
            size="sm"
            disabled={!hasUnsaved}
            onClick={handleSave}
          >
            Save
          </Button>
        </Stack>
      </div>

      <textarea
        className="input functions-editor__textarea"
        value={draft}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="// Write TypeScript source here…"
      />
    </div>
  )
}

// ── FunctionsEditor ───────────────────────────────────────────────────────────

export interface FunctionsEditorProps {
  /** Optional callback fired after a file is created/deleted/renamed */
  onChanged?: () => void
}

/**
 * Editor for the `functions/` directory of the active space.
 * Lists all `functions/<name>.ts` files, allows create / rename / delete,
 * and lets the user edit their raw TypeScript source in-place.
 *
 * Relies on the active SpaceFS context (SpaceProvider must be a parent).
 */
export function FunctionsEditor({ onChanged }: FunctionsEditorProps) {
  const spaceFS = useSpaceFS()
  const functionMatches = useGlob(P.globs.allFunctions)

  const functionNames = functionMatches
    .map(p => functionNameFromPath(p))
    .filter(Boolean)
    .sort()

  const [selectedName, setSelectedName] = useUIState<string | null>('functions-editor.selected', null)
  const [showNewForm, setShowNewForm] = useUIState<boolean>('functions-editor.show-new', false)
  const [newName, setNewName] = useUIState<string>('functions-editor.new-name', '')
  const newInputRef = useRef<HTMLInputElement>(null)

  // Auto-select first available item when selection is cleared
  useEffect(() => {
    if (selectedName && functionNames.includes(selectedName)) return
    setSelectedName(functionNames[0] ?? null)
  }, [functionNames, selectedName, setSelectedName])

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim().replace(/\.ts$/, '')
    if (!trimmed || !spaceFS) return
    const path = P.functionFile(trimmed)
    const template = DEFAULT_FUNCTION_TEMPLATE.replace('untitled', trimmed)
    spaceFS.writeFile(path, template)
    setSelectedName(trimmed)
    setNewName('')
    setShowNewForm(false)
    onChanged?.()
  }, [newName, spaceFS, onChanged, setSelectedName, setNewName, setShowNewForm])

  const handleDelete = useCallback((name: string) => {
    if (!spaceFS) return
    spaceFS.deleteFile(P.functionFile(name))
    if (selectedName === name) {
      const remaining = functionNames.filter(n => n !== name)
      setSelectedName(remaining[0] ?? null)
    }
    onChanged?.()
  }, [spaceFS, selectedName, functionNames, setSelectedName, onChanged])

  const handleRename = useCallback((oldName: string, newNameValue: string) => {
    if (!spaceFS) return
    const oldPath = P.functionFile(oldName)
    const newPath = P.functionFile(newNameValue)
    const existing = spaceFS.readFile(oldPath) ?? ''
    spaceFS.writeFile(newPath, existing)
    spaceFS.deleteFile(oldPath)
    if (selectedName === oldName) setSelectedName(newNameValue)
    onChanged?.()
  }, [spaceFS, selectedName, setSelectedName, onChanged])

  const selectedPath = selectedName ? P.functionFile(selectedName) : null

  return (
    <div className="functions-editor">
      {/* Header */}
      <div className="functions-editor__header">
        <Label>Functions ({functionNames.length})</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowNewForm(true)
            requestAnimationFrame(() => newInputRef.current?.focus())
          }}
        >
          + New function
        </Button>
      </div>

      {/* New-function inline form */}
      {showNewForm && (
        <div className="functions-editor__new-form">
          <Input
            ref={newInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
              if (e.key === 'Escape') { setShowNewForm(false); setNewName('') }
            }}
            placeholder="functionName"
            style={{ flex: 1 }}
          />
          <Caption muted>.ts</Caption>
          <Button size="sm" variant="primary" disabled={!newName.trim()} onClick={handleCreate}>
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewForm(false); setNewName('') }}>
            Cancel
          </Button>
        </div>
      )}

      {/* File list */}
      <div className="functions-editor__list">
        {functionNames.length === 0 ? (
          <div className="functions-editor__empty">
            <Caption muted>No functions yet. Create one to get started.</Caption>
          </div>
        ) : (
          functionNames.map(name => (
            <FunctionListItem
              key={name}
              name={name}
              isActive={selectedName === name}
              onSelect={() => setSelectedName(name)}
              onDelete={() => handleDelete(name)}
              onRename={newNameValue => handleRename(name, newNameValue)}
            />
          ))
        )}
      </div>

      {/* Code editor pane */}
      {selectedPath && (
        <FunctionCodeEditor key={selectedPath} functionPath={selectedPath} />
      )}
    </div>
  )
}

export default FunctionsEditor
