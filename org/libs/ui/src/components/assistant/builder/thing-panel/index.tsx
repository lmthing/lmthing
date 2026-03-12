/**
 * ThingPanel - Sliding side panel for Thing AI assistant.
 * US-213 / C10: Slides in from right, full height, close button.
 */
import { useEffect, useRef } from 'react'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Bot, X } from 'lucide-react'

export interface ThingPanelProps {
  onClose: () => void
}

export function ThingPanel({ onClose }: ThingPanelProps) {
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    // Trigger slide-in: start off-screen, animate to position
    el.style.transform = 'translateX(100%)'
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)'
    })
  }, [])

  return (
    <aside
      ref={panelRef}
      style={{
        width: '22rem',
        flexShrink: 0,
        borderLeft: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)',
        transition: 'transform 0.25s ease',
      }}
    >
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot style={{ width: '1rem', height: '1rem', color: 'var(--color-agent)' }} />
          <Heading level={4}>Thing</Heading>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X style={{ width: '0.875rem', height: '0.875rem' }} />
        </Button>
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        color: 'var(--color-muted-foreground)',
      }}>
        <Bot style={{ width: '2.5rem', height: '2.5rem', strokeWidth: 1, marginBottom: '1rem' }} />
        <Caption muted style={{ textAlign: 'center', maxWidth: '16rem' }}>
          Thing can help you configure this agent, generate instructions, and optimize knowledge selection.
        </Caption>
      </div>
    </aside>
  )
}
