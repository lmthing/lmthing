import '@lmthing/css/elements/content/badge/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export type BadgeVariant = 'default' | 'primary' | 'muted' | 'success'

export interface BadgeProps extends React.ComponentProps<'span'> {
  variant?: BadgeVariant
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'badge',
        variant === 'primary' && 'badge--primary',
        variant === 'muted' && 'badge--muted',
        variant === 'success' && 'badge--success',
        className
      )}
      {...props}
    />
  )
}

export { Badge }
