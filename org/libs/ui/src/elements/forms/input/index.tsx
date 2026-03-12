import '@/css/elements/forms/input/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.ComponentProps<'input'> {
  error?: boolean
}

function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'input',
        error && 'input--error',
        props.size === undefined && undefined,
        className
      )}
      {...props}
    />
  )
}

export { Input }
