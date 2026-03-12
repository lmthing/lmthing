import '@lmthing/css/elements/forms/button/index.css'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../../lib/utils'

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(
        'btn',
        variant === 'primary' && 'btn--primary',
        variant === 'ghost' && 'btn--ghost',
        variant === 'outline' && 'btn--outline',
        variant === 'destructive' && 'btn--destructive',
        size === 'sm' && 'btn--sm',
        size === 'lg' && 'btn--lg',
        size === 'icon' && 'btn--icon',
        className
      )}
      {...props}
    />
  )
}

export { Button }
