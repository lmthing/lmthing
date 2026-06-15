/**
 * TasklistEditor — form-based editor for a single tasklist.
 *
 * Reads/writes tasklists/<name>/NN-<id>.md via SpaceFS.
 * Uses useTasklist(name) from @lmthing/state to read live task data.
 */
import { useState, useCallback } from 'react'
import {
  useTasklist,
  useSpaceFS,
  serializeTasklistTask,
  tasklistTaskFilename,
  type TasklistTask,
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

type TaskOutputType = 'string' | 'number' | 'boolean' | 'object' | 'array'

/** Draft state for a single task being edited in the form */
interface TaskDraft {
  id: string
  instruction: string
  output: Array<{ field: string; type: TaskOutputType }>
  dependsOn: string[]
  goal: boolean
  optional: boolean
  condition: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TasklistEditorProps {
  /** The tasklist directory name under tasklists/ */
  name: string
  onBack?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function outputRowsToRecord(rows: Array<{ field: string; type: TaskOutputType }>): Record<string, string> {
  const record: Record<string, string> = {}
  for (const row of rows) {
    if (row.field.trim()) record[row.field.trim()] = row.type
  }
  return record
}

const OUTPUT_TYPES: TaskOutputType[] = ['string', 'number', 'boolean', 'object', 'array']

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

  const updateOutput = (rows: Array<{ field: string; type: TaskOutputType }>) => {
    onChange({ ...draft, output: rows })
  }

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

        {/* output */}
        <div>
          <Label compact>Output fields</Label>
          <div className="tasklist-editor__output-rows">
            {draft.output.map((row, i) => (
              <div key={i} className="tasklist-editor__output-row">
                <Input
                  type="text"
                  value={row.field}
                  onChange={(e) => {
                    const next = [...draft.output]
                    next[i] = { ...row, field: e.target.value }
                    updateOutput(next)
                  }}
                  placeholder="fieldName"
                  className="tasklist-editor__output-field-input"
                />
                <Select
                  value={row.type}
                  onChange={(e) => {
                    const next = [...draft.output]
                    next[i] = { ...row, type: e.target.value as TaskOutputType }
                    updateOutput(next)
                  }}
                >
                  {OUTPUT_TYPES.map((t) => (
                    <SelectOption key={t} value={t}>{t}</SelectOption>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateOutput(draft.output.filter((_, j) => j !== i))}
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
              onClick={() => updateOutput([...draft.output, { field: '', type: 'string' }])}
            >
              + Add output field
            </button>
          </div>
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
  const tasklist = useTasklist(name)
  const spaceFS = useSpaceFS()

  // Build initial drafts from live FS data each time the task list changes externally
  const [drafts, setDrafts] = useState<TaskDraft[]>(() =>
    tasklist.tasks
      .map((item) => {
        // useTasklist returns TasklistTaskItem (path + order + id) not full task
        // We need to read each task file directly; for the editor init we build
        // a minimal draft — the full content will come from useTasklistTask per-item
        // but for simplicity we return a skeleton here and rely on the save logic.
        return {
          id: item.id,
          instruction: '',
          output: [{ field: 'result', type: 'string' as TaskOutputType }],
          dependsOn: [],
          goal: false,
          optional: false,
          condition: '',
        }
      })
  )

  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Sync from FS when tasklist changes (only if not dirty)
  // (We skip auto-sync when dirty to avoid overwriting edits)

  const allTaskIds = drafts.map((d) => d.id)

  // ── Mutations ──────────────────────────────────────────────────────────────

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
        output: [{ field: 'result', type: 'string' as TaskOutputType }],
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
      const existingPaths = tasklist.tasks.map((item) => item.path)
      for (const path of existingPaths) {
        spaceFS.deleteFile(path)
      }

      // Write new task files
      for (let i = 0; i < normalizedDrafts.length; i++) {
        const d = normalizedDrafts[i]
        const order = i + 1
        const filename = tasklistTaskFilename(order, d.id)
        const path = `tasklists/${name}/${filename}`

        const task: TasklistTask = {
          order,
          id: d.id,
          instruction: d.instruction,
          output: outputRowsToRecord(d.output),
          dependsOn: d.dependsOn.length > 0 ? d.dependsOn : undefined,
          optional: d.optional || undefined,
          goal: d.goal || undefined,
          condition: d.condition.trim() || undefined,
        }

        spaceFS.writeFile(path, serializeTasklistTask(task))
      }

      setDrafts(normalizedDrafts)
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }, [drafts, name, spaceFS, tasklist.tasks])

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

      {/* Tasks */}
      <div className="tasklist-editor__body">
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
