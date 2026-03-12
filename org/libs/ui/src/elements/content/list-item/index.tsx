import '@lmthing/css/elements/content/list-item/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface ListItemProps extends React.ComponentProps<'div'> {
  selected?: boolean
  label?: React.ReactNode
  meta?: React.ReactNode
}

function ListItem({ className, selected, label, meta, children, ...props }: ListItemProps) {
  return (
    <div
      className={cn('list-item', selected && 'list-item--selected', className)}
      {...props}
    >
      {label != null ? (
        <>
          <span className="list-item__label">{label}</span>
          {meta != null && <span className="list-item__meta">{meta}</span>}
        </>
      ) : (
        children
      )}
    </div>
  )
}

export { ListItem }
