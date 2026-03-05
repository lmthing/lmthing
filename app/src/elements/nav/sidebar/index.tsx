import '@/css/elements/nav/sidebar/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SidebarProps extends React.ComponentProps<'nav'> {
  collapsed?: boolean
}

function Sidebar({ className, collapsed, ...props }: SidebarProps) {
  return (
    <nav
      className={cn('sidebar', collapsed && 'sidebar--collapsed', className)}
      {...props}
    />
  )
}

export interface SidebarItemProps extends React.ComponentProps<'div'> {
  active?: boolean
}

function SidebarItem({ className, active, ...props }: SidebarItemProps) {
  return (
    <div
      className={cn('sidebar__item', active && 'sidebar__item--active', className)}
      {...props}
    />
  )
}

export { Sidebar, SidebarItem }
