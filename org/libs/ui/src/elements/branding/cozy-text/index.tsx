import '@lmthing/css/elements/branding/cozy-text/index.css'
import { cn } from '../../../lib/utils'

export interface CozyThingTextProps {
  text?: string
  className?: string
}

export function CozyThingText({ text = '', className }: CozyThingTextProps) {
  const lowerText = text.toLowerCase().trim()

  if (lowerText === 'lmt') {
    return (
      <span className={cn('cozy-text', className)}>
        <span className="cozy-text--neutral">lm</span>
        <span className="cozy-text--brand-1">t</span>
      </span>
    )
  }

  if (lowerText === 'lmthing') {
    return (
      <span className={cn('cozy-text', className)}>
        <span className="cozy-text--neutral">lm</span>
        <span className="cozy-text--brand-1">t</span>
        <span className="cozy-text--brand-2">h</span>
        <span className="cozy-text--brand-3">i</span>
        <span className="cozy-text--brand-4">n</span>
        <span className="cozy-text--brand-5">g</span>
      </span>
    )
  }

  if (lowerText === 'thing') {
    return (
      <span className={cn('cozy-text', className)}>
        <span className="cozy-text--brand-1">t</span>
        <span className="cozy-text--brand-2">h</span>
        <span className="cozy-text--brand-3">i</span>
        <span className="cozy-text--brand-4">n</span>
        <span className="cozy-text--brand-5">g</span>
      </span>
    )
  }

  return <span className={className}>{text}</span>
}

export default CozyThingText
