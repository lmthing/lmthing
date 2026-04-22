import '@lmthing/css/elements/layouts/stack/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export type StackGap = 'sm' | 'md' | 'lg'

export interface StackProps extends React.ComponentProps<'div'> {
  row?: boolean
  gap?: StackGap
}

function Stack({ className, row, gap, ...props }: StackProps) {
  return (
    <div
      className={cn(
        'stack',
        row && 'stack--row',
        gap === 'sm' && 'stack--gap-sm',
        gap === 'md' && 'stack--gap-md',
        gap === 'lg' && 'stack--gap-lg',
        className
      )}
      {...props}
    />
  )
}

export { Stack }
