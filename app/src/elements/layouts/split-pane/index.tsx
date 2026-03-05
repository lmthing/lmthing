import '@/css/elements/layouts/split-pane/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

function SplitPane({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('split-pane', className)} {...props} />
}

function SplitPanePrimary({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('split-pane__primary', className)} {...props} />
}

function SplitPaneSecondary({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('split-pane__secondary', className)} {...props} />
}

export { SplitPane, SplitPanePrimary, SplitPaneSecondary }
