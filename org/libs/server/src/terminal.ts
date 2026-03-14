import * as pty from 'node-pty'

export interface ManagedTerminal {
  write(data: string): void
  resize(cols: number, rows: number): void
  onData(cb: (data: string) => void): () => void
  kill(): void
}

const DEFAULT_SHELL = process.env.SHELL || '/bin/bash'
const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

/**
 * Spawn a new PTY terminal session.
 */
export function createTerminal(opts?: {
  cols?: number
  rows?: number
  cwd?: string
  env?: Record<string, string>
}): ManagedTerminal {
  const cols = opts?.cols ?? DEFAULT_COLS
  const rows = opts?.rows ?? DEFAULT_ROWS

  const proc = pty.spawn(DEFAULT_SHELL, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: opts?.cwd ?? process.env.HOME ?? '/home',
    env: {
      ...process.env as Record<string, string>,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      ...opts?.env,
    },
  })

  const listeners = new Set<(data: string) => void>()

  proc.onData((data) => {
    for (const cb of listeners) cb(data)
  })

  return {
    write(data: string) {
      proc.write(data)
    },
    resize(c: number, r: number) {
      proc.resize(c, r)
    },
    onData(cb: (data: string) => void) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    kill() {
      listeners.clear()
      proc.kill()
    },
  }
}
