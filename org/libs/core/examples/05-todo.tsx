/**
 * Example 5: Todo list manager
 *
 * An in-memory todo list with React UI components.
 * Demonstrates: mutable state, CRUD operations, display() for lists, ask() for user input.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/05-todo.tsx -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/05-todo.tsx -m openai:gpt-4o-mini -d debug-run.xml
 */

import React from 'react'

// ── In-memory store ──

interface Todo {
  id: number
  text: string
  done: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

let nextId = 1
const todos: Todo[] = []

// ── React Components ──

const PRIORITY_COLORS: Record<string, string> = {
  high: '#e53e3e',
  medium: '#dd6b20',
  low: '#38a169',
}

const PRIORITY_BADGES: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

/** Display a list of todos */
export function TodoList({ items, title }: { items: Todo[]; title?: string }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#888', fontFamily: 'sans-serif' }}>
        📭 No todos to show
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 480, fontFamily: 'sans-serif' }}>
      {title && <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>📋 {title}</div>}
      {items.map(todo => (
        <div
          key={todo.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            borderBottom: '1px solid #eee', opacity: todo.done ? 0.5 : 1,
          }}
        >
          <span style={{ fontSize: 18 }}>{todo.done ? '✅' : '⬜'}</span>
          <span style={{ flex: 1, textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
          <span style={{ fontSize: 12 }}>{PRIORITY_BADGES[todo.priority]}</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>#{todo.id}</span>
        </div>
      ))}
    </div>
  )
}

/** Display todo statistics */
export function TodoStatsCard({ stats }: { stats: { total: number; done: number; pending: number; byPriority: Record<string, number> } }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 320, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>📊 Todo Stats</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Total</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#38a169' }}>{stats.done}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Done</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dd6b20' }}>{stats.pending}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Pending</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#666' }}>
        {Object.entries(stats.byPriority).map(([priority, count]) => (
          <span key={priority} style={{ marginRight: 12 }}>
            {PRIORITY_BADGES[priority]} {priority}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Form to add a new todo */
export function AddTodoForm() {
  return (
    <div>
      <div style={{ marginBottom: 12, fontWeight: 'bold' }}>➕ Add a new todo</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Task</label>
        <input name="text" type="text" placeholder="What needs to be done?" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Priority</label>
        <select name="priority" defaultValue="medium" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }}>
          <option value="low">🟢 Low</option>
          <option value="medium">🟡 Medium</option>
          <option value="high">🔴 High</option>
        </select>
      </div>
    </div>
  )
}

/** Form to confirm deletion */
export function ConfirmDeleteForm({ todo }: { todo: Todo }) {
  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>🗑️ Delete todo?</div>
      <div style={{ padding: 8, background: '#fff3f3', borderRadius: 4, marginBottom: 8 }}>
        #{todo.id} — {todo.text} ({todo.priority})
      </div>
      <input type="hidden" name="confirm" value="true" />
      <div style={{ fontSize: 13, color: '#888' }}>Click Submit to confirm deletion, or Cancel to keep it.</div>
    </div>
  )
}

// ── Exported functions ──

/** Add a new todo item */
export function addTodo(text: string, priority: 'low' | 'medium' | 'high' = 'medium'): Todo {
  const todo: Todo = {
    id: nextId++,
    text,
    done: false,
    priority,
    createdAt: new Date().toISOString(),
  }
  todos.push(todo)
  return todo
}

/** List all todos, optionally filtered */
export function listTodos(filter?: 'all' | 'done' | 'pending'): Todo[] {
  if (filter === 'done') return todos.filter(t => t.done)
  if (filter === 'pending') return todos.filter(t => !t.done)
  return [...todos]
}

/** Mark a todo as done */
export function completeTodo(id: number): Todo | null {
  const todo = todos.find(t => t.id === id)
  if (!todo) return null
  todo.done = true
  return todo
}

/** Delete a todo */
export function deleteTodo(id: number): boolean {
  const idx = todos.findIndex(t => t.id === id)
  if (idx === -1) return false
  todos.splice(idx, 1)
  return true
}

/** Update a todo's text or priority */
export function updateTodo(id: number, updates: { text?: string; priority?: 'low' | 'medium' | 'high' }): Todo | null {
  const todo = todos.find(t => t.id === id)
  if (!todo) return null
  if (updates.text) todo.text = updates.text
  if (updates.priority) todo.priority = updates.priority
  return todo
}

/** Get statistics about the todo list */
export function todoStats(): { total: number; done: number; pending: number; byPriority: Record<string, number> } {
  const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0 }
  for (const t of todos) byPriority[t.priority]++
  return {
    total: todos.length,
    done: todos.filter(t => t.done).length,
    pending: todos.filter(t => !t.done).length,
    byPriority,
  }
}

// ── CLI config ──

export const replConfig = {
  instruct: `You are a todo list assistant with rich React UI. Help the user manage their tasks using display components:
- display(<TodoList items={todos} title="My Todos" />) to show the todo list
- display(<TodoStatsCard stats={stats} />) to show statistics
- var input = await ask(<AddTodoForm />) to ask the user to create a todo (returns { text, priority })
- var confirm = await ask(<ConfirmDeleteForm todo={todoItem} />) to confirm before deleting
After making changes, always display the updated list.`,
  functionSignatures: `
  addTodo(text: string, priority?: 'low' | 'medium' | 'high'): Todo — Add a new todo. Returns { id, text, done, priority, createdAt }
  listTodos(filter?: 'all' | 'done' | 'pending'): Todo[] — List todos, optionally filtered
  completeTodo(id: number): Todo | null — Mark a todo as done
  deleteTodo(id: number): boolean — Delete a todo by ID
  updateTodo(id: number, updates: { text?, priority? }): Todo | null — Update text or priority
  todoStats(): { total, done, pending, byPriority } — Get list statistics

  ## React Components (use with display() and ask())
  <TodoList items={Todo[]} title?={string} /> — Renders the todo list with checkmarks and priority badges
  <TodoStatsCard stats={{ total, done, pending, byPriority }} /> — Shows stats with counts and priority breakdown
  <AddTodoForm /> — Form to capture a new todo (use with ask(), returns { text, priority })
  <ConfirmDeleteForm todo={Todo} /> — Confirmation dialog before deleting (use with ask())
  `,
  maxTurns: 12,
}
