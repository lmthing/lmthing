/**
 * TasklistEditor — form-based editor for a single tasklist.
 *
 * Reads/writes tasklists/<name>/NN-<id>.md and tasklists/<name>/index.md via SpaceFS.
 * Uses useTasklistTasks(name) from @lmthing/state to read live, fully-parsed task data.
 * Uses useTasklistIndex(name) to read the manifest (input schema + description).
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  useTasklistTasks,
  useTasklistIndex,
  useSpaceFS,
  serializeTasklistTask,
  serializeTasklistIndex,
  tasklistTaskFilename,
  P,
  type TasklistTask,
  type TasklistIndex,
} from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { cn } from '@lmthing/ui/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array'

/** A field→type pair used in the input/output editors */
interface SchemaRow {
  field: string
  type: TaskFieldType
}

/** Draft state for a single task being edited in the form */
interface TaskDraft {
  id: string
  instruction: string
  input: SchemaRow[]
  output: SchemaRow[]
  dependsOn: string[]
  goal: boolean
  optional: boolean
  condition: string
}

/** Draft state for the tasklist manifest (index.md) */
interface ManifestDraft {
  description: string
  input: SchemaRow[]
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TasklistEditorProps {
  /** The tasklist directory name under tasklists/ */
  name: string
  onBack?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function schemaRowsToRecord(rows: SchemaRow[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (const row of rows) {
    if (row.field.trim()) record[row.field.trim()] = row.type
  }
  return record
}

function recordToSchemaRows(record: Record<string, string> | undefined): SchemaRow[] {
  if (!record || Object.keys(record).length === 0) return []
  return Object.entries(record).map(([field, type]) => ({
    field,
    type: type as TaskFieldType,
  }))
}

const FIELD_TYPES: TaskFieldType[] = ['string', 'number', 'boolean', 'object', 'array']

// Convert a parsed TasklistTask to a TaskDraft
function taskToTaskDraft(task: TasklistTask): TaskDraft {
  return {
    id: task.id,
    instruction: task.instruction,
    input: recordToSchemaRows(task.input),
    output: recordToSchemaRows(task.output).length > 0
      ? recordToSchemaRows(task.output)
      : [{ field: 'result', type: 'string' }],
    dependsOn: task.dependsOn ?? [],
    goal: task.goal ?? false,
    optional: task.optional ?? false,
    condition: task.condition ?? '',
  }
}

// ─── SchemaEditor ────────────────────────────────────────────────────────────

interface SchemaEditorProps {
  rows: SchemaRow[]
  onChange: (rows: SchemaRow[]) => void
  addLabel?: string
  emptyHint?: string
}

function SchemaEditor({ rows, onChange, addLabel = '+ Add field', emptyHint }: SchemaEditorProps) {
  return (
    <div className="tasklist-editor__output-rows">
      {rows.map((row, i) => (
        <div key={i} className="tasklist-editor__output-row">
          <Input
            type="text"
            value={row.field}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...row, field: e.target.value }
              onChange(next)
            }}
            placeholder="fieldName"
            className="tasklist-editor__output-field-input"
          />
          <Select
            value={row.type}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...row, type: e.target.value as TaskFieldType }
              onChange(next)
            }}
          >
            {FIELD_TYPES.map((t) => (
              <SelectOption key={t} value={t}>{t}</SelectOption>
            ))}
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            title="Remove field"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>
      ))}
      <button
        className="tasklist-editor__add-output-btn"
        onClick={() => onChange([...rows, { field: '', type: 'string' }])}
      >
        {addLabel}
      </button>
      {emptyHint && rows.length === 0 && (
        <Caption muted>{emptyHint}</Caption>
      )}
    </div>
  )
}

// ─── ManifestSection ─────────────────────────────────────────────────────────

interface ManifestSectionProps {
  draft: ManifestDraft
  onChange: (draft: ManifestDraft) => void
}

function ManifestSection({ draft, onChange }: ManifestSectionProps) {
  return (
    <div className="tasklist-editor__manifest">
      <div className="tasklist-editor__manifest-header">
        <Heading level={3}>Manifest</Heading>
        <Caption muted>Tasklist-level input schema and description (index.md)</Caption>
      </div>
      <div className="tasklist-editor__manifest-body">
        {/* description */}
        <div>
          <Label compact>Description</Label>
          <Textarea
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            placeholder="Describe what this tasklist accomplishes..."
            compact
          />
        </div>

        {/* input schema */}
        <div>
          <Label compact>Input fields</Label>
          <SchemaEditor
            rows={draft.input}
            onChange={(rows) => onChange({ ...draft, input: rows })}
            addLabel="+ Add input field"
            emptyHint="No input fields defined. Add fields if this tasklist requires external inputs."
          />
          <Caption muted>Declare the fields callers must supply when running this tasklist.</Caption>
        </div>
      </div>
    </div>
  )
}

// ─── TaskForm ────────────────────────────────────────────────────────────────

interface TaskFormProps {
  draft: TaskDraft
  allTaskIds: string[]
  onChange: (draft: TaskDraft) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  index: number
  onSetGoal: () => void
}

function TaskForm({
  draft,
  allTaskIds,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  index,
  onSetGoal,
}: TaskFormProps) {
  const otherTaskIds = allTaskIds.filter((id) => id !== draft.id)

  const toggleDepends = (taskId: string) => {
    const next = draft.dependsOn.includes(taskId)
      ? draft.dependsOn.filter((d) => d !== taskId)
      : [...draft.dependsOn, taskId]
    onChange({ ...draft, dependsOn: next })
  }

  return (
    <div className={cn('tasklist-editor__task-form', draft.goal && 'tasklist-editor__task-form--goal')}>
      {/* Order + controls header */}
      <div className="tasklist-editor__task-header">
        <span className="tasklist-editor__task-order">{index + 1}</span>
        {draft.goal && (
          <span className="tasklist-editor__goal-badge">goal</span>
        )}
        <div className="tasklist-editor__task-controls">
          <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={isFirst} title="Move up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={isLast} title="Move down">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="tasklist-editor__task-body">
        {/* id */}
        <div>
          <Label compact required>ID</Label>
          <Input
            type="text"
            value={draft.id}
            onChange={(e) => onChange({ ...draft, id: e.target.value })}
            placeholder="task_id (snake_case)"
          />
          <Caption muted>Used as the filename suffix (NN-id.md) and in dependsOn references.</Caption>
        </div>

        {/* instruction */}
        <div>
          <Label compact required>Instruction</Label>
          <Textarea
            value={draft.instruction}
            onChange={(e) => onChange({ ...draft, instruction: e.target.value })}
            placeholder="Describe what this task should accomplish..."
            compact
          />
        </div>

        {/* input */}
        <div>
          <Label compact>Input fields</Label>
          <SchemaEditor
            rows={draft.input}
            onChange={(rows) => onChange({ ...draft, input: rows })}
            addLabel="+ Add input field"
            emptyHint="No input fields. Add fields if this task requires specific inputs."
          />
          <Caption muted>Declare the fields this task expects as input (field name → type).</Caption>
        </div>

        {/* output */}
        <div>
          <Label compact>Output fields</Label>
          <SchemaEditor
            rows={draft.output}
            onChange={(rows) => onChange({ ...draft, output: rows })}
            addLabel="+ Add output field"
          />
          <Caption muted>Declare the fields this task produces (field name → type).</Caption>
        </div>

        {/* dependsOn */}
        {otherTaskIds.length > 0 && (
          <div>
            <Label compact>Depends on</Label>
            <div className="tasklist-editor__depends-grid">
              {otherTaskIds.map((taskId) => (
                <button
                  key={taskId}
                  onClick={() => toggleDepends(taskId)}
                  className={cn(
                    'tasklist-editor__depends-btn',
                    draft.dependsOn.includes(taskId)
                      ? 'tasklist-editor__depends-btn--active'
                      : 'tasklist-editor__depends-btn--inactive'
                  )}
                >
                  {taskId}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* goal / optional / condition row */}
        <div className="tasklist-editor__flags-row">
          {/* goal radio */}
          <div className="tasklist-editor__flag-item">
            <button
              onClick={onSetGoal}
              className={cn(
                'tasklist-editor__toggle',
                draft.goal ? 'tasklist-editor__toggle--on' : 'tasklist-editor__toggle--off'
              )}
              title="Mark as goal task (exactly one per tasklist)"
            >
              <span className={cn(
                'tasklist-editor__toggle-knob',
                draft.goal ? 'tasklist-editor__toggle-knob--on' : 'tasklist-editor__toggle-knob--off'
              )} />
            </button>
            <Label compact>Goal</Label>
          </div>

          {/* optional toggle */}
          <div className="tasklist-editor__flag-item">
            <button
              onClick={() => onChange({ ...draft, optional: !draft.optional })}
              className={cn(
                'tasklist-editor__toggle',
                draft.optional ? 'tasklist-editor__toggle--on' : 'tasklist-editor__toggle--off'
              )}
            >
              <span className={cn(
                'tasklist-editor__toggle-knob',
                draft.optional ? 'tasklist-editor__toggle-knob--on' : 'tasklist-editor__toggle-knob--off'
              )} />
            </button>
            <Label compact>Optional</Label>
          </div>

          {/* condition */}
          <div className="tasklist-editor__flag-condition">
            <Label compact>Condition</Label>
            <Input
              type="text"
              value={draft.condition}
              onChange={(e) => onChange({ ...draft, condition: e.target.value })}
              placeholder="e.g. outputs.previous.success === true"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TasklistEditor ────────────────────────────────────────────────────────────

export function TasklistEditor({ name, onBack }: TasklistEditorProps) {
  // Wave-1 APIs: fully-parsed tasks + manifest
  const taskEntries = useTasklistTasks(name)
  const tasklistIndex = useTasklistIndex(name)
  const spaceFS = useSpaceFS()

  // Track whether the draft has been seeded from live FS data.
  // We seed once (or when the component re-mounts for a different tasklist)
  // and then leave edits untouched until the user saves.
  const seededRef = useRef<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ── Task drafts ───────────────────────────────────────────────────────────

  const [drafts, setDrafts] = useState<TaskDraft[]>(() =>
    taskEntries
      .map((entry) => entry.task)
      .filter((t): t is TasklistTask => t !== null)
      .map(taskToTaskDraft)
  )

  // ── Manifest draft ────────────────────────────────────────────────────────

  const [manifestDraft, setManifestDraft] = useState<ManifestDraft>(() => ({
    description: tasklistIndex?.description ?? '',
    input: recordToSchemaRows(tasklistIndex?.input),
  }))

  // Re-seed from live FS when switching to a different tasklist or on first mount
  useEffect(() => {
    if (seededRef.current === name) return // already seeded for this name
    seededRef.current = name
    setIsDirty(false)

    const seeded = taskEntries
      .map((entry) => entry.task)
      .filter((t): t is TasklistTask => t !== null)
      .map(taskToTaskDraft)
    setDrafts(seeded)

    setManifestDraft({
      description: tasklistIndex?.description ?? '',
      input: recordToSchemaRows(tasklistIndex?.input),
    })
  // We intentionally only re-seed when the tasklist name changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  const allTaskIds = drafts.map((d) => d.id)

  // ── Task mutations ─────────────────────────────────────────────────────────

  const updateDraft = useCallback((index: number, updated: TaskDraft) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? updated : d)))
    setIsDirty(true)
  }, [])

  const addTask = useCallback(() => {
    const newId = `task_${Date.now()}`
    setDrafts((prev) => [
      ...prev,
      {
        id: newId,
        instruction: '',
        input: [],
        output: [{ field: 'result', type: 'string' as TaskFieldType }],
        dependsOn: [],
        goal: prev.length === 0, // first task gets goal by default
        optional: false,
        condition: '',
      },
    ])
    setIsDirty(true)
  }, [])

  const deleteTask = useCallback((index: number) => {
    setDrafts((prev) => {
      const next = prev.filter((_, i) => i !== index)
      // ensure exactly one goal
      const hasGoal = next.some((d) => d.goal)
      if (!hasGoal && next.length > 0) {
        next[next.length - 1] = { ...next[next.length - 1], goal: true }
      }
      return next
    })
    setIsDirty(true)
  }, [])

  const moveTask = useCallback((fromIndex: number, toIndex: number) => {
    setDrafts((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setIsDirty(true)
  }, [])

  const setGoal = useCallback((index: number) => {
    setDrafts((prev) =>
      prev.map((d, i) => ({ ...d, goal: i === index }))
    )
    setIsDirty(true)
  }, [])

  const updateManifest = useCallback((updated: ManifestDraft) => {
    setManifestDraft(updated)
    setIsDirty(true)
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!spaceFS) return
    setIsSaving(true)

    try {
      // Ensure exactly one goal
      let normalizedDrafts = [...drafts]
      const goalCount = normalizedDrafts.filter((d) => d.goal).length
      if (goalCount === 0 && normalizedDrafts.length > 0) {
        normalizedDrafts[normalizedDrafts.length - 1] = {
          ...normalizedDrafts[normalizedDrafts.length - 1],
          goal: true,
        }
      } else if (goalCount > 1) {
        // Keep only the last goal
        let foundGoal = false
        normalizedDrafts = normalizedDrafts.map((d, i) => {
          if (d.goal) {
            if (i === normalizedDrafts.length - 1 || !foundGoal) {
              foundGoal = true
              return d
            }
            return { ...d, goal: false }
          }
          return d
        })
      }

      // Remove old task files for this tasklist
      const existingPaths = taskEntries.map((entry) => entry.path)
      for (const path of existingPaths) {
        spaceFS.deleteFile(path)
      }

      // Write new task files
      for (let i = 0; i < normalizedDrafts.length; i++) {
        const d = normalizedDrafts[i]
        const order = i + 1
        const filename = tasklistTaskFilename(order, d.id)
        const path = `tasklists/${name}/${filename}`

        const inputRecord = schemaRowsToRecord(d.input)
        const task: TasklistTask = {
          order,
          id: d.id,
          instruction: d.instruction,
          ...(Object.keys(inputRecord).length > 0 ? { input: inputRecord } : {}),
          output: schemaRowsToRecord(d.output),
          dependsOn: d.dependsOn.length > 0 ? d.dependsOn : undefined,
          optional: d.optional || undefined,
          goal: d.goal || undefined,
          condition: d.condition.trim() || undefined,
        }

        spaceFS.writeFile(path, serializeTasklistTask(task))
      }

      // Write (or overwrite) the manifest index.md
      const inputRecord = schemaRowsToRecord(manifestDraft.input)
      const indexData: TasklistIndex = {
        ...(Object.keys(inputRecord).length > 0 ? { input: inputRecord } : {}),
        description: manifestDraft.description,
      }
      spaceFS.writeFile(P.tasklistIndex(name), serializeTasklistIndex(indexData, manifestDraft.description))

      setDrafts(normalizedDrafts)
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }, [drafts, manifestDraft, name, spaceFS, taskEntries])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tasklist-editor">
      {/* Header */}
      <div className="tasklist-editor__header">
        <div className="tasklist-editor__header-inner">
          <Stack row gap="md" className="tasklist-editor__header-top">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} title="Back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Button>
            )}
            <div>
              <Heading level={2}>{name}</Heading>
              <Caption muted>
                {drafts.length} task{drafts.length !== 1 ? 's' : ''}
                {isDirty && ' • unsaved changes'}
              </Caption>
            </div>
            <div className="tasklist-editor__header-actions">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Stack>
        </div>
      </div>

      {/* Body */}
      <div className="tasklist-editor__body">
        {/* Manifest section (index.md) */}
        <ManifestSection
          draft={manifestDraft}
          onChange={updateManifest}
        />

        {/* Divider */}
        <div className="tasklist-editor__section-divider" />

        {/* Tasks */}
        {drafts.length === 0 ? (
          <div className="tasklist-editor__empty">
            <Heading level={3}>No tasks yet</Heading>
            <Caption muted>Add your first task to get started.</Caption>
            <Button variant="primary" onClick={addTask}>Add Task</Button>
          </div>
        ) : (
          <div className="tasklist-editor__task-list">
            {drafts.map((draft, index) => (
              <TaskForm
                key={`${index}-${draft.id}`}
                draft={draft}
                allTaskIds={allTaskIds}
                index={index}
                isFirst={index === 0}
                isLast={index === drafts.length - 1}
                onChange={(updated) => updateDraft(index, updated)}
                onDelete={() => deleteTask(index)}
                onMoveUp={() => moveTask(index, index - 1)}
                onMoveDown={() => moveTask(index, index + 1)}
                onSetGoal={() => setGoal(index)}
              />
            ))}
          </div>
        )}

        <button className="tasklist-editor__add-task-btn" onClick={addTask}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Task
        </button>
      </div>
    </div>
  )
}

// Keep the old name as an alias so any existing import of WorkflowEditor still compiles.
export { TasklistEditor as WorkflowEditor }
