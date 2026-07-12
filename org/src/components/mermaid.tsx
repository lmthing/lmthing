import { useEffect, useId, useRef, useState } from 'react'
import mermaid from 'mermaid'

let initialised = false

function isDark(): boolean {
  if (typeof document === 'undefined') return false
  return !!document.querySelector('[data-theme="dark"]')
}

function ensureInit() {
  if (initialised) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: isDark() ? 'dark' : 'default',
    fontFamily: 'var(--font-sans)',
  })
  initialised = true
}

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rawId = useId()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    if (!el) return
    ensureInit()
    // mermaid render ids must be valid CSS selectors — strip colons from useId.
    const id = 'mermaid-' + rawId.replace(/[^a-zA-Z0-9]/g, '')
    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (!cancelled && el) {
          el.innerHTML = svg
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [chart, rawId])

  if (error) {
    return (
      <div className="doc-mermaid doc-mermaid--error">
        <div>
          Failed to render diagram:{'\n'}
          {error}
        </div>
      </div>
    )
  }

  return <div ref={ref} className="doc-mermaid" role="img" aria-label="diagram" />
}
