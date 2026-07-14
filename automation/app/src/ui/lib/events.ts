import { useEffect, useRef } from 'react'
import { sseUrl } from './api.js'

/**
 * Subscribe to an SSE endpoint. `handlers` maps event names to callbacks.
 * Reconnects on error (EventSource does this natively, but we re-arm to be safe).
 */
export function useSse(path: string, handlers: Record<string, (data: any) => void>) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    let es: EventSource | null = null
    let stopped = false
    const open = () => {
      if (stopped) return
      es = new EventSource(sseUrl(path))
      es.onmessage = (e) => ref.current['message']?.(JSON.parse(e.data))
      for (const name of Object.keys(ref.current)) {
        if (name === 'message') continue
        es.addEventListener(name, (e: MessageEvent) => {
          try {
            ref.current[name]?.(JSON.parse(e.data))
          } catch {
            ref.current[name]?.(e.data)
          }
        })
      }
      es.onerror = () => {
        es?.close()
        if (!stopped) setTimeout(open, 2000)
      }
    }
    open()
    return () => {
      stopped = true
      es?.close()
    }
  }, [path])
}
