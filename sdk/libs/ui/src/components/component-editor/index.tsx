/**
 * ComponentEditor
 *
 * Reusable editor for the `components/` directory of the active space.
 * Manages both `components/view/<Name>.tsx` (display components, used with
 * `display()`) and `components/form/<Name>.tsx` (form components, used with
 * `ask()`). Each component is a single TSX file with a default export.
 *
 * Provides create / rename / delete / raw-source editing in a code textarea,
 * following the same draft/save pattern as the agent-builder and topic-editor.
 */
import '@lmthing/css/components/component-editor/index.css'
import { useCallback, useEffect, useRef } from 'react'
import { useSpaceFS, useGlob, useFile, useUIState, P } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'

// ── types ─────────────────────────────────────────────────────────────────────

type ComponentKind = 'view' | 'form'

// ── helpers ───────────────────────────────────────────────────────────────────

const VIEW_TEMPLATE = (name: string) => `import { Stack } from '@lmthing/ui';

/**
 * ${name} — describe what this view component displays.
 */
export default function ${name}({ }: {  }) {
  return (
    <Stack>
      {/* render output here */}
    </Stack>
  );
}
`

const FORM_TEMPLATE = (name: string) => `import { Form, TextField, SubmitButton } from '@lmthing/ui';

/**
 * ${name} — describe what input this form collects.
 */
export default function ${name}({ onSubmit }: { onSubmit: (values: Record<string, unknown>) => void }) {
  return (
    <Form onSubmit={onSubmit}>
      <TextField name="value" label="Value" />
      <SubmitButton>Submit</SubmitButton>
    </Form>
  );
}
`

function componentNameFromPath(path: string): string {
  return path.split('/').pop()?.replace(/\.tsx$/, '') ?? path
}

function pathForComponent(kind: ComponentKind, name: string): string {
  return kind === 'view' ? P.viewComponent(name) : P.formComponent(name)
}

// ── ComponentListItem ─────────────────────────────────────────────────────────

interface ComponentListItemProps {
  name: string
  kind: ComponentKind
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}

function ComponentListItem({ name, kind, isActive, onSelect, onDelete, onRename }: ComponentListItemProps) {
  const stateKey = `comp-item.${kind}.${name}`
  const [renaming, setRenaming] = useUIState(`${stateKey}.renaming`, false)
  const [renameValue, setRenameValue] = useUIState(`${stateKey}.rename-value`, name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setRenameValue(name)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [renaming, name, setRenameValue])

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim().replace(/\.tsx$/, '')
    if (trimmed && trimmed !== name) onRename(trimmed)
    setRenaming(false)
  }, [renameValue, name, onRename, setRenaming])

  return (
    <div
      className={`component-editor__list-item${isActive ? ' component-editor__list-item--active' : ''}`}
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
        <span className="component-editor__list-item-name">{name}.tsx</span>
      )}

      <div className="component-editor__list-item-actions" onClick={e => e.stopPropagation()}>
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

// ── ComponentCodeEditor ───────────────────────────────────────────────────────

interface ComponentCodeEditorProps {
  componentPath: string
  kind: ComponentKind
}

function ComponentCodeEditor({ componentPath, kind }: ComponentCodeEditorProps) {
  const spaceFS = useSpaceFS()
  const rawContent = useFile(componentPath)
  const name = componentNameFromPath(componentPath)

  const [draft, setDraft] = useUIState<string>(`comp-editor.${componentPath}.draft`, '')
  const [hasUnsaved, setHasUnsaved] = useUIState<boolean>(`comp-editor.${componentPath}.unsaved`, false)

  // Sync draft when file content changes
  const syncKey = `${componentPath}::${rawContent ?? ''}`
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
    spaceFS.writeFile(componentPath, draft)
    setHasUnsaved(false)
  }, [spaceFS, componentPath, draft, hasUnsaved, setHasUnsaved])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  return (
    <div className="component-editor__pane">
      <div className="component-editor__pane-header">
        <Stack row gap="sm">
          <Label>{name}.tsx</Label>
          <span className={`component-editor__kind-badge component-editor__kind-badge--${kind}`}>
            {kind}
          </span>
          <Caption muted>{componentPath}</Caption>
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
        className="input component-editor__textarea"
        value={draft}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="// Write TSX source here — import only from '@lmthing/ui'…"
      />
    </div>
  )
}

// ── ComponentEditor ───────────────────────────────────────────────────────────

export interface ComponentEditorProps {
  /** Optional callback fired after a file is created/deleted/renamed */
  onChanged?: () => void
}

/**
 * Editor for the `components/` directory of the active space.
 * Manages view components (`components/view/<Name>.tsx`) and form components
 * (`components/form/<Name>.tsx`). Provides create / rename / delete and
 * raw TSX source editing.
 *
 * View/form distinction is shown clearly in the UI via kind badges and
 * separate list sections. Relies on the active SpaceFS context (SpaceProvider
 * must be a parent).
 */
export function ComponentEditor({ onChanged }: ComponentEditorProps) {
  const spaceFS = useSpaceFS()
  const viewMatches = useGlob(P.globs.allViewComponents)
  const formMatches = useGlob(P.globs.allFormComponents)

  const viewNames = viewMatches.map(componentNameFromPath).filter(Boolean).sort()
  const formNames = formMatches.map(componentNameFromPath).filter(Boolean).sort()

  const [selectedKind, setSelectedKind] = useUIState<ComponentKind>('component-editor.selected-kind', 'view')
  const [selectedName, setSelectedName] = useUIState<string | null>('component-editor.selected-name', null)

  const [showNewForm, setShowNewForm] = useUIState<boolean>('component-editor.show-new', false)
  const [newName, setNewName] = useUIState<string>('component-editor.new-name', '')
  const [newKind, setNewKind] = useUIState<ComponentKind>('component-editor.new-kind', 'view')
  const newInputRef = useRef<HTMLInputElement>(null)

  // Auto-select first available item
  useEffect(() => {
    const names = selectedKind === 'view' ? viewNames : formNames
    if (selectedName && names.includes(selectedName)) return
    const fallback = viewNames[0] ? ['view', viewNames[0]] as const : formNames[0] ? ['form', formNames[0]] as const : null
    if (fallback) {
      setSelectedKind(fallback[0])
      setSelectedName(fallback[1])
    } else {
      setSelectedName(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNames.join(','), formNames.join(','), selectedKind, selectedName])

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim().replace(/\.tsx$/, '')
    if (!trimmed || !spaceFS) return
    const path = pathForComponent(newKind, trimmed)
    const template = newKind === 'view' ? VIEW_TEMPLATE(trimmed) : FORM_TEMPLATE(trimmed)
    spaceFS.writeFile(path, template)
    setSelectedKind(newKind)
    setSelectedName(trimmed)
    setNewName('')
    setShowNewForm(false)
    onChanged?.()
  }, [newName, newKind, spaceFS, onChanged, setSelectedKind, setSelectedName, setNewName, setShowNewForm])

  const handleDelete = useCallback((kind: ComponentKind, name: string) => {
    if (!spaceFS) return
    spaceFS.deleteFile(pathForComponent(kind, name))
    if (selectedKind === kind && selectedName === name) {
      const remaining = (kind === 'view' ? viewNames : formNames).filter(n => n !== name)
      setSelectedName(remaining[0] ?? null)
    }
    onChanged?.()
  }, [spaceFS, selectedKind, selectedName, viewNames, formNames, setSelectedName, onChanged])

  const handleRename = useCallback((kind: ComponentKind, oldName: string, newNameValue: string) => {
    if (!spaceFS) return
    const oldPath = pathForComponent(kind, oldName)
    const newPath = pathForComponent(kind, newNameValue)
    const existing = spaceFS.readFile(oldPath) ?? ''
    // Update the default-export identifier in the template if possible
    const updated = existing.replace(
      new RegExp(`export default function ${oldName}`, 'g'),
      `export default function ${newNameValue}`
    )
    spaceFS.writeFile(newPath, updated)
    spaceFS.deleteFile(oldPath)
    if (selectedKind === kind && selectedName === oldName) setSelectedName(newNameValue)
    onChanged?.()
  }, [spaceFS, selectedKind, selectedName, setSelectedName, onChanged])

  const selectedPath = selectedName ? pathForComponent(selectedKind, selectedName) : null

  return (
    <div className="component-editor">
      {/* Header */}
      <div className="component-editor__header">
        <Label>Components ({viewNames.length + formNames.length})</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowNewForm(true)
            requestAnimationFrame(() => newInputRef.current?.focus())
          }}
        >
          + New component
        </Button>
      </div>

      {/* New-component inline form */}
      {showNewForm && (
        <div className="component-editor__new-form">
          <Input
            ref={newInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
              if (e.key === 'Escape') { setShowNewForm(false); setNewName('') }
            }}
            placeholder="ComponentName"
            style={{ flex: 1 }}
          />
          <Select
            value={newKind}
            onChange={e => setNewKind(e.target.value as ComponentKind)}
            style={{ width: '6rem' }}
          >
            <SelectOption value="view">view</SelectOption>
            <SelectOption value="form">form</SelectOption>
          </Select>
          <Caption muted>.tsx</Caption>
          <Button size="sm" variant="primary" disabled={!newName.trim()} onClick={handleCreate}>
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewForm(false); setNewName('') }}>
            Cancel
          </Button>
        </div>
      )}

      {/* View components section */}
      <div>
        <div className="component-editor__section-title">
          <Label compact>View</Label>
          <span className="component-editor__kind-badge component-editor__kind-badge--view">display()</span>
        </div>
        <div className="component-editor__list">
          {viewNames.length === 0 ? (
            <div className="component-editor__empty">
              <Caption muted>No view components yet.</Caption>
            </div>
          ) : (
            viewNames.map(name => (
              <ComponentListItem
                key={`view:${name}`}
                name={name}
                kind="view"
                isActive={selectedKind === 'view' && selectedName === name}
                onSelect={() => { setSelectedKind('view'); setSelectedName(name) }}
                onDelete={() => handleDelete('view', name)}
                onRename={newNameValue => handleRename('view', name, newNameValue)}
              />
            ))
          )}
        </div>
      </div>

      {/* Form components section */}
      <div>
        <div className="component-editor__section-title">
          <Label compact>Form</Label>
          <span className="component-editor__kind-badge component-editor__kind-badge--form">ask()</span>
        </div>
        <div className="component-editor__list">
          {formNames.length === 0 ? (
            <div className="component-editor__empty">
              <Caption muted>No form components yet.</Caption>
            </div>
          ) : (
            formNames.map(name => (
              <ComponentListItem
                key={`form:${name}`}
                name={name}
                kind="form"
                isActive={selectedKind === 'form' && selectedName === name}
                onSelect={() => { setSelectedKind('form'); setSelectedName(name) }}
                onDelete={() => handleDelete('form', name)}
                onRename={newNameValue => handleRename('form', name, newNameValue)}
              />
            ))
          )}
        </div>
      </div>

      {/* Code editor pane */}
      {selectedPath && (
        <ComponentCodeEditor
          key={selectedPath}
          componentPath={selectedPath}
          kind={selectedKind}
        />
      )}
    </div>
  )
}

export default ComponentEditor
