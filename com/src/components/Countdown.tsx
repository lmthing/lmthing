import { useEffect, useState } from 'react'
import { ALPHA_LAUNCH_TS } from '@/lib/alpha'

type Remaining = { days: number; hours: number; minutes: number; seconds: number }

function remaining(): Remaining {
  const ms = Math.max(0, ALPHA_LAUNCH_TS - Date.now())
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

const CELLS: { key: keyof Remaining; label: string }[] = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
]

/**
 * Live countdown to the public launch ({@link ALPHA_LAUNCH_TS}). Ticks once a
 * second; clamps to zero at launch. Design-token styling only.
 */
export function Countdown() {
  const [time, setTime] = useState<Remaining>(remaining)

  useEffect(() => {
    const id = setInterval(() => setTime(remaining()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {CELLS.map(({ key, label }) => (
        <div
          key={key}
          className="flex w-16 flex-col items-center rounded-lg border border-border bg-background px-2 py-3 sm:w-[4.5rem]"
        >
          <span className="font-mono text-2xl tabular-nums text-foreground sm:text-3xl">
            {pad(time[key])}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
