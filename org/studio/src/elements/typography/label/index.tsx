import '@/css/elements/typography/label/index.css'
import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

export interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  compact?: boolean
  required?: boolean
}

function Label({ className, compact, required, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'label',
        compact && 'label--sm',
        required && 'label--required',
        className
      )}
      {...props}
    />
  )
}

export { Label }
