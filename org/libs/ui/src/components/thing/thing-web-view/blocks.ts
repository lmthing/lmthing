import type { SessionEvent } from '@lmthing/repl'
import type { UIBlock, BlockAction } from './types'

export function blocksReducer(blocks: UIBlock[], action: BlockAction): UIBlock[] {
  if (action.type === 'reset') return []
  if (action.type === 'add_user_message') {
    return [...blocks, { type: 'user', id: action.id, text: action.text }]
  }

  const event = action.event as SessionEvent
  switch (event.type) {
    case 'code': {
      const idx = blocks.findIndex((b) => b.id === event.blockId)
      if (idx >= 0) {
        const block = blocks[idx] as Extract<UIBlock, { type: 'code' }>
        const newCode = block.code + event.lines
        const newBlocks = [...blocks]
        newBlocks[idx] = { ...block, code: newCode, lineCount: countLines(newCode) }
        return newBlocks
      }
      return [
        ...blocks,
        {
          type: 'code',
          id: event.blockId,
          code: event.lines,
          streaming: true,
          lineCount: countLines(event.lines),
        },
      ]
    }
    case 'code_complete': {
      return blocks.map((b) =>
        b.id === event.blockId && b.type === 'code' ? { ...b, streaming: false } : b,
      )
    }
    case 'read':
      return [...blocks, { type: 'read', id: event.blockId, payload: event.payload }]
    case 'error':
      return [...blocks, { type: 'error', id: event.blockId, error: event.error }]
    case 'hook':
      return [
        ...blocks,
        {
          type: 'hook',
          id: event.blockId,
          hookId: event.hookId,
          action: event.action,
          detail: event.detail,
        },
      ]
    case 'display':
      return [...blocks, { type: 'display', id: event.componentId, jsx: event.jsx }]
    case 'ask_start':
      return [
        ...blocks,
        { type: 'form', id: event.formId, jsx: event.jsx, status: 'active' as const },
      ]
    case 'ask_end':
      return blocks.map((b) =>
        b.type === 'form' && b.id === event.formId ? { ...b, status: 'submitted' as const } : b,
      )
    case 'tasklist_declared':
      return [
        ...blocks,
        {
          type: 'tasklist_declared',
          id: `tl_plan_${event.tasklistId}_${Date.now()}`,
          tasklistId: event.tasklistId,
          plan: event.plan,
        },
      ]
    case 'task_complete':
      return [
        ...blocks,
        {
          type: 'task_complete',
          id: `tl_${event.tasklistId}_${event.id}`,
          tasklistId: event.tasklistId,
          taskId: event.id,
          output: event.output,
        },
      ]
    default:
      return blocks
  }
}

function countLines(code: string): number {
  return code.split('\n').filter((l) => l.trim().length > 0).length
}
