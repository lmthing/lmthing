import '@lmthing/css/elements/nav/tab-bar/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface TabBarTab {
  id: string
  label: React.ReactNode
}

export interface TabBarProps extends React.ComponentProps<'div'> {
  tabs: TabBarTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
}

function TabBar({ className, tabs, activeTab, onTabChange, ...props }: TabBarProps) {
  return (
    <div className={cn('tab-bar', className)} role="tablist" {...props}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn('tab-bar__tab', activeTab === tab.id && 'tab-bar__tab--active')}
          onClick={() => onTabChange?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export { TabBar }
