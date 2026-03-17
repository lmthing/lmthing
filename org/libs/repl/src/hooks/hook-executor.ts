import ts from 'typescript'
import type { Hook, HookAction, HookContext, HookMatch } from '../session/types'
import { HookRegistry } from './hook-registry'
import { findMatches } from './pattern-matcher'

export interface HookExecutionResult {
  action: 'execute' | 'skip' | 'interrupt'
  source: string
  interruptMessage?: string
  sideEffects: Array<() => void | Promise<void>>
  matchedHooks: Array<{ hookId: string; action: string }>
}

/**
 * Run matching hooks for a statement.
 * Returns the final action: execute (possibly with transformed source), skip, or interrupt.
 */
export async function executeHooks(
  source: string,
  phase: 'before' | 'after',
  registry: HookRegistry,
  context: HookContext,
): Promise<HookExecutionResult> {
  const hooks = registry.listByPhase(phase)
  const result: HookExecutionResult = {
    action: 'execute',
    source,
    sideEffects: [],
    matchedHooks: [],
  }

  if (hooks.length === 0) return result

  const sourceFile = ts.createSourceFile(
    'hook.ts',
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  )

  for (const hook of hooks) {
    const matches = findMatches(sourceFile, hook.pattern)
    if (matches.length === 0) continue

    for (const match of matches) {
      let action: HookAction
      try {
        action = await hook.handler(match, context)
        registry.recordSuccess(hook.id)
      } catch (err) {
        registry.recordFailure(hook.id)
        continue // Treat as 'continue' on error
      }

      result.matchedHooks.push({ hookId: hook.id, action: action.type })

      switch (action.type) {
        case 'continue':
          break

        case 'side_effect':
          result.sideEffects.push(action.fn)
          break

        case 'transform':
          if (phase === 'before') {
            result.source = action.newSource
          }
          break

        case 'interrupt':
          if (phase === 'before') {
            result.action = 'interrupt'
            result.interruptMessage = action.message
            return result // Terminal — stop processing hooks
          }
          break

        case 'skip':
          if (phase === 'before') {
            result.action = 'skip'
            return result // Terminal — stop processing hooks
          }
          break
      }
    }
  }

  return result
}
