import { readFile } from 'node:fs/promises'

interface CpuSnapshot {
  idle: number
  total: number
}

let lastCpu: CpuSnapshot | null = null

/**
 * Read CPU usage from /proc/stat.
 * Returns percentage since last call (null on first call).
 */
export async function getCpuPercent(): Promise<number | null> {
  try {
    const stat = await readFile('/proc/stat', 'utf-8')
    const line = stat.split('\n')[0] // "cpu  user nice system idle ..."
    const parts = line.split(/\s+/).slice(1).map(Number)

    const idle = parts[3]
    const total = parts.reduce((a, b) => a + b, 0)

    if (!lastCpu) {
      lastCpu = { idle, total }
      return null
    }

    const idleDelta = idle - lastCpu.idle
    const totalDelta = total - lastCpu.total
    lastCpu = { idle, total }

    if (totalDelta === 0) return 0
    return Math.round((1 - idleDelta / totalDelta) * 100 * 10) / 10
  } catch {
    return null
  }
}

/**
 * Read memory usage from /proc/meminfo.
 */
export async function getMemoryInfo(): Promise<{
  usedMb: number | null
  totalMb: number | null
}> {
  try {
    const info = await readFile('/proc/meminfo', 'utf-8')
    const lines = info.split('\n')

    let totalKb = 0
    let availableKb = 0

    for (const line of lines) {
      if (line.startsWith('MemTotal:')) {
        totalKb = parseInt(line.split(/\s+/)[1], 10)
      } else if (line.startsWith('MemAvailable:')) {
        availableKb = parseInt(line.split(/\s+/)[1], 10)
      }
    }

    const totalMb = Math.round(totalKb / 1024)
    const usedMb = Math.round((totalKb - availableKb) / 1024)

    return { usedMb, totalMb }
  } catch {
    return { usedMb: null, totalMb: null }
  }
}
