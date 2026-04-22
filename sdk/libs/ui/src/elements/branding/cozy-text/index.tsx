import '@lmthing/css/elements/branding/cozy-text/index.css'
import { cn } from '../../../lib/utils'

export interface CozyThingTextProps {
  text?: string
  className?: string
}

function LmtBrand() {
  return (
    <>
      <span className="cozy-text--neutral">lm</span>
      <span className="cozy-text--brand-1">t</span>
    </>
  )
}

function ThingBrand() {
  return (
    <>
      <span className="cozy-text--brand-1">t</span>
      <span className="cozy-text--brand-2">h</span>
      <span className="cozy-text--brand-3">i</span>
      <span className="cozy-text--brand-4">n</span>
      <span className="cozy-text--brand-5">g</span>
    </>
  )
}

function LmthingBrand() {
  return (
    <>
      <span className="cozy-text--neutral">lm</span>
      <ThingBrand />
    </>
  )
}

export function CozyThingText({ text = '', className }: CozyThingTextProps) {
  const lowerText = text.toLowerCase().trim()

  if (lowerText === 'lmt') {
    return (
      <span className={cn('cozy-text', className)}>
        <LmtBrand />
      </span>
    )
  }

  if (lowerText === 'lmthing') {
    return (
      <span className={cn('cozy-text', className)}>
        <LmthingBrand />
      </span>
    )
  }

  if (lowerText === 'thing') {
    return (
      <span className={cn('cozy-text', className)}>
        <ThingBrand />
      </span>
    )
  }

  // Handle "lmthing.suffix" patterns (e.g. "lmthing.studio", "lmthing.computer")
  if (lowerText.startsWith('lmthing.')) {
    const suffix = text.trim().slice(8) // preserve original casing of suffix
    return (
      <span className={cn('cozy-text', className)}>
        <LmthingBrand />
        <span className="cozy-text--neutral">.{suffix}</span>
      </span>
    )
  }

  // Handle "lmt.suffix" patterns (e.g. "lmt.studio")
  if (lowerText.startsWith('lmt.')) {
    const suffix = text.trim().slice(4)
    return (
      <span className={cn('cozy-text', className)}>
        <LmtBrand />
        <span className="cozy-text--neutral">.{suffix}</span>
      </span>
    )
  }

  return <span className={className}>{text}</span>
}

export default CozyThingText
