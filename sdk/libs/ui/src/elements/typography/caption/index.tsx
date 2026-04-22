import '@lmthing/css/elements/typography/caption/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface CaptionProps extends React.ComponentProps<'span'> {
  muted?: boolean
}

function Caption({ className, muted, ...props }: CaptionProps) {
  return (
    <span
      className={cn('caption', muted && 'caption--muted', className)}
      {...props}
    />
  )
}

export { Caption }
