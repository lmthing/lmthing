import '@/css/elements/nav/breadcrumb/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BreadcrumbSegment {
  label: string
  onClick?: () => void
}

export interface BreadcrumbProps extends React.ComponentProps<'nav'> {
  segments: BreadcrumbSegment[]
  separator?: React.ReactNode
}

function Breadcrumb({
  className,
  segments,
  separator = '/',
  ...props
}: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={cn('breadcrumb', className)} {...props}>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="breadcrumb__separator" aria-hidden="true">
              {separator}
            </span>
          )}
          <span
            className="breadcrumb__segment"
            onClick={segment.onClick}
            aria-current={index === segments.length - 1 ? 'page' : undefined}
          >
            {segment.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  )
}

export { Breadcrumb }
