/**
 * ThingPanel - Sliding side panel for Thing AI assistant.
 * US-213 / C10: Slides in from right, full height, close button.
 */
import '@lmthing/css/components/assistant/builder/index.css'
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
      className="thing-panel"
    >
      <div className="thing-panel__header">
        <div className="thing-panel__header-left">
          <Bot className="thing-panel__header-icon" />
          <Heading level={4}>Thing</Heading>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="thing-panel__close-icon" />
        </Button>
      </div>
      <div className="thing-panel__body">
        <Bot className="thing-panel__body-icon" />
        <Caption muted className="thing-panel__body-caption">
          Thing can help you configure this agent, generate instructions, and optimize knowledge selection.
        </Caption>
      </div>
    </aside>
  )
}
