/** Tail active attempts' output.jsonl and POST new stream-json lines in batches. */
import { openSync, readSync, closeSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { attemptDir } from './paths.mjs'

export function makeTailer({ instance, push }) {
  /** key `${task}:${round}:${attempt}` → { offset, pending } */
  const tails = new Map()

  function tailActive(runs) {
    const active = (runs || []).filter((r) => r.outcome === 'running')
    const keys = new Set(active.map((r) => `${r.task}:${r.round}:${r.attempt}`))
    for (const k of tails.keys()) if (!keys.has(k)) tails.delete(k)

    for (const r of active) {
      const key = `${r.task}:${r.round}:${r.attempt}`
      const file = resolve(attemptDir(instance, r.round, r.task, r.attempt), 'output.jsonl')
      if (!existsSync(file)) continue
      let st
      try {
        st = statSync(file)
      } catch {
        continue
      }
      let t = tails.get(key)
      if (!t) {
        // Start from the end (recent activity) to avoid re-streaming a huge file on attach.
        t = { offset: st.size, pending: '' }
        tails.set(key, t)
        continue
      }
      if (st.size < t.offset) {
        t.offset = 0
        t.pending = ''
      }
      if (st.size === t.offset) continue

      const len = st.size - t.offset
      const buf = Buffer.alloc(len)
      let fd
      try {
        fd = openSync(file, 'r')
        readSync(fd, buf, 0, len, t.offset)
      } catch {
        continue
      } finally {
        if (fd !== undefined) closeSync(fd)
      }
      t.offset = st.size

      const text = t.pending + buf.toString('utf8')
      const parts = text.split('\n')
      t.pending = parts.pop() ?? ''
      const lines = []
      for (const line of parts) {
        const s = line.trim()
        if (!s) continue
        try {
          lines.push(JSON.parse(s))
        } catch {
          /* partial line — skip */
        }
      }
      if (lines.length) {
        push.post(`/transcript/${r.task}/${r.round}/${r.attempt}`, { lines })
      }
    }
  }

  return { tailActive }
}
