/**
 * Temporary debugging aid, not part of the port. dsh's agent-loop reports a
 * turn-ending error via `dispatch.emit('agent/error', {error, ...})` — a
 * fire-and-forget event with no default listener — before sanitizing it down
 * to {message, code} for the persisted session log. Without a listener, the
 * real Error (with its stack) is lost. See dsh/packages/README.md.
 */
export const name = 'lmthing-debug-agent-error'

export function apply(ctx) {
  ctx.on('agent/error', ({ error, turn, step }) => {
    console.error(`[lmthing-debug] agent/error turn=${turn} step=${step}:`, error?.stack ?? error)
  })
}
