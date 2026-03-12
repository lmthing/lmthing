import '@/css/elements/typography/heading/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

export type HeadingLevel = 1 | 2 | 3 | 4

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
  muted?: boolean
}

function Heading({ className, level = 2, muted, children, ...props }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
  return (
    <Tag
      className={cn(
        `heading-${level}`,
        muted && 'heading--muted',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export { Heading }
