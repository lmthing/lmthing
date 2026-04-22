import '@lmthing/css/elements/content/terminal/index.css'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { cn } from '../../../lib/utils'

export interface TerminalSession {
  write(data: string): void
  onData(cb: (data: string) => void): () => void
  resize(cols: number, rows: number): void
}

export interface TerminalProps {
  session: TerminalSession | null
  className?: string
  fontSize?: number
}

function Terminal({ session, className, fontSize = 14 }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [xterm, setXterm] = useState<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Initialize xterm when container gets dimensions
  const initRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false

    function tryInit() {
      if (disposed || !container) return
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return

      observer.disconnect()

      const instance = new XTerm({
        fontSize,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        cursorBlink: true,
      })

      const fitAddon = new FitAddon()
      instance.loadAddon(fitAddon)
      instance.loadAddon(new WebLinksAddon())
      instance.open(container)

      requestAnimationFrame(() => {
        try { fitAddon.fit() } catch { /* */ }
      })

      fitAddonRef.current = fitAddon
      setXterm(instance)
    }

    const observer = new ResizeObserver(() => tryInit())
    observer.observe(container)
    tryInit()

    return () => {
      disposed = true
      observer.disconnect()
      // xterm cleanup happens in a separate effect since it's state
    }
  }, [fontSize])

  // Cleanup xterm on unmount
  useEffect(() => {
    return () => {
      if (xterm) {
        xterm.dispose()
        setXterm(null)
        fitAddonRef.current = null
      }
    }
  }, [xterm])

  // Wire session I/O — depends on both xterm instance AND session
  useEffect(() => {
    if (!xterm || !session) return

    const unsubData = session.onData((data) => {
      xterm.write(data)
    })

    const disposable = xterm.onData((data) => {
      session.write(data)
    })

    return () => {
      unsubData()
      disposable.dispose()
    }
  }, [xterm, session])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    const fitAddon = fitAddonRef.current
    if (!container || !fitAddon || !xterm) return

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        if (session) {
          session.resize(xterm.cols, xterm.rows)
        }
      } catch { /* */ }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [xterm, session])

  return (
    <div className={cn('terminal', !session && 'terminal--loading', className)}>
      <div ref={initRef} className="terminal__viewport" />
    </div>
  )
}

export { Terminal }
