/**
 * Example 5: Todo list manager
 *
 * An in-memory todo list that the agent can manage.
 * Demonstrates: mutable state, CRUD operations, ask() for user input, multi-turn.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/05-todo.ts -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/05-todo.ts -m openai:gpt-4o-mini -d debug-run.xml
 */

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
  instruct: `You are a todo list assistant. Help the user manage their tasks. When adding todos, ask for clarification if the priority is unclear. Present lists in a clear format. After making changes, show the updated list.`,
  functionSignatures: `
  addTodo(text: string, priority?: 'low' | 'medium' | 'high'): Todo — Add a new todo. Returns { id, text, done, priority, createdAt }
  listTodos(filter?: 'all' | 'done' | 'pending'): Todo[] — List todos, optionally filtered
  completeTodo(id: number): Todo | null — Mark a todo as done
  deleteTodo(id: number): boolean — Delete a todo by ID
  updateTodo(id: number, updates: { text?, priority? }): Todo | null — Update text or priority
  todoStats(): { total, done, pending, byPriority } — Get list statistics
  `,
  maxTurns: 12,
}
