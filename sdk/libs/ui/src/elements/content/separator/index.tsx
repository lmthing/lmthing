import '@lmthing/css/elements/content/separator/index.css'
import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '../../../lib/utils'

export interface SeparatorProps extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  vertical?: boolean
}

function Separator({ className, vertical, orientation, ...props }: SeparatorProps) {
  const isVertical = vertical || orientation === 'vertical'
  return (
    <SeparatorPrimitive.Root
      orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cn('separator', isVertical && 'separator--vertical', className)}
      {...props}
    />
  )
}

export { Separator }
