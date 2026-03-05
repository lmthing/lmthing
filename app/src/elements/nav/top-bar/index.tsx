import '@/css/elements/nav/top-bar/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TopBarProps extends Omit<React.ComponentProps<'header'>, 'title'> {
  title?: React.ReactNode
  actions?: React.ReactNode
}

function TopBar({ className, title, actions, children, ...props }: TopBarProps) {
  return (
    <header className={cn('top-bar', className)} {...props}>
      {title != null && <span className="top-bar__title">{title}</span>}
      {children}
      {actions != null && <div className="top-bar__actions">{actions}</div>}
    </header>
  )
}

export { TopBar }
