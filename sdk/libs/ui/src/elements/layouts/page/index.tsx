import '@lmthing/css/elements/layouts/page/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface PageProps extends React.ComponentProps<'div'> {
  full?: boolean
}

function Page({ className, full, ...props }: PageProps) {
  return (
    <div className={cn('page', full && 'page--full', className)} {...props} />
  )
}

function PageHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('page__header', className)} {...props} />
}

function PageBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('page__body', className)} {...props} />
}

export { Page, PageHeader, PageBody }
