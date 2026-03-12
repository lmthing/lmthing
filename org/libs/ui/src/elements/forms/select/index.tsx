import '@lmthing/css/elements/forms/select/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface SelectProps extends React.ComponentProps<'select'> {}

function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="select">
      <select
        className={cn('select__trigger', className)}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

function SelectOption(props: React.ComponentProps<'option'>) {
  return <option {...props} />
}

export { Select, SelectOption }
