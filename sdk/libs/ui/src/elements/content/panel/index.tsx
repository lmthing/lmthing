import '@lmthing/css/elements/content/panel/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface PanelProps extends React.ComponentProps<'div'> {
  split?: boolean
}

function Panel({ className, split, ...props }: PanelProps) {
  return (
    <div className={cn('panel', split && 'panel--split', className)} {...props} />
  )
}

function PanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('panel__header', className)} {...props} />
}

function PanelBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('panel__body', className)} {...props} />
}

export { Panel, PanelHeader, PanelBody }
