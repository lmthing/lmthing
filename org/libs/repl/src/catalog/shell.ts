import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { CatalogModule } from './types'

const execFileAsync = promisify(execFile)

let shellCwd = process.cwd()

export function setShellCwd(dir: string): void {
  shellCwd = dir
}

const shellModule: CatalogModule = {
  id: 'shell',
  description: 'Shell command execution',
  functions: [
    {
      name: 'exec',
      description: 'Run shell command',
      signature: '(command: string, options?: { cwd?: string, timeout?: number }) => Promise<{ stdout: string, stderr: string, exitCode: number }>',
      fn: async (command: unknown, options?: unknown) => {
        const opts = options as { cwd?: string; timeout?: number } | undefined
        const args = (command as string).split(' ')
        const cmd = args[0]
        const cmdArgs = args.slice(1)
        try {
          const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, {
            cwd: opts?.cwd ?? shellCwd,
            timeout: opts?.timeout ?? 30_000,
          })
          return { stdout, stderr, exitCode: 0 }
        } catch (err: any) {
          return {
            stdout: err.stdout ?? '',
            stderr: err.stderr ?? err.message,
            exitCode: err.code ?? 1,
          }
        }
      },
    },
    {
      name: 'execLive',
      description: 'Streaming command output',
      signature: "(command: string, options?: { cwd?: string, timeout?: number }) => AsyncIterable<{ stream: 'stdout' | 'stderr', data: string }>",
      fn: (command: unknown, options?: unknown) => {
        const opts = options as { cwd?: string; timeout?: number } | undefined
        const args = (command as string).split(' ')
        const cmd = args[0]
        const cmdArgs = args.slice(1)

        return {
          async *[Symbol.asyncIterator]() {
            const child = spawn(cmd, cmdArgs, {
              cwd: opts?.cwd ?? shellCwd,
              timeout: opts?.timeout ?? 30_000,
            })

            const chunks: Array<{ stream: 'stdout' | 'stderr'; data: string }> = []
            let resolve: (() => void) | null = null
            let done = false

            child.stdout?.on('data', (data: Buffer) => {
              chunks.push({ stream: 'stdout', data: data.toString() })
              resolve?.()
            })
            child.stderr?.on('data', (data: Buffer) => {
              chunks.push({ stream: 'stderr', data: data.toString() })
              resolve?.()
            })
            child.on('close', () => {
              done = true
              resolve?.()
            })
            child.on('error', () => {
              done = true
              resolve?.()
            })

            while (!done || chunks.length > 0) {
              if (chunks.length === 0 && !done) {
                await new Promise<void>(r => { resolve = r })
              }
              while (chunks.length > 0) yield chunks.shift()!
            }
          },
        }
      },
    },
    {
      name: 'which',
      description: 'Find binary in PATH',
      signature: '(binary: string) => Promise<string | null>',
      fn: async (binary: unknown) => {
        try {
          const { stdout } = await execFileAsync('which', [binary as string])
          return stdout.trim() || null
        } catch {
          return null
        }
      },
    },
  ],
}

export default shellModule
