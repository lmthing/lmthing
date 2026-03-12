import '@lmthing/css/elements/forms/textarea/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  compact?: boolean
}

function Textarea({ className, compact, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn('textarea', compact && 'textarea--sm', className)}
      {...props}
    />
  )
}

export { Textarea }
