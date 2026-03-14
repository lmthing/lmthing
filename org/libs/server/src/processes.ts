import { readdir, readFile } from 'node:fs/promises'

export interface ProcessInfo {
  pid: number
  command: string
  cpu: number | null
  memoryMB: number | null
}

const PAGE_SIZE = 4096 // Linux default

/**
 * List running processes by reading /proc.
 * Returns user-relevant processes (filters out kernel threads).
 */
export async function listProcesses(): Promise<ProcessInfo[]> {
  const result: ProcessInfo[] = []

  try {
    const entries = await readdir('/proc')

    for (const entry of entries) {
      const pid = parseInt(entry, 10)
      if (isNaN(pid) || pid <= 1) continue

      try {
        const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf-8')
        if (!cmdline) continue // kernel thread

        const command = cmdline.replace(/\0/g, ' ').trim()
        if (!command) continue

        // Read memory from /proc/{pid}/statm
        let memoryMB: number | null = null
        try {
          const statm = await readFile(`/proc/${pid}/statm`, 'utf-8')
          const residentPages = parseInt(statm.split(' ')[1], 10)
          memoryMB = Math.round((residentPages * PAGE_SIZE) / (1024 * 1024) * 10) / 10
        } catch { /* skip */ }

        result.push({ pid, command, cpu: null, memoryMB })
      } catch {
        // Process may have exited between readdir and readFile
      }
    }
  } catch {
    // /proc not available (non-Linux)
  }

  return result
}
