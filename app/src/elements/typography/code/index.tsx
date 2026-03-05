import '@/css/elements/typography/code/index.css'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CodeProps extends React.ComponentProps<'code'> {
  block?: boolean
}

function Code({ className, block, ...props }: CodeProps) {
  if (block) {
    return <pre className={cn('code-block', className)}><code {...props} /></pre>
  }
  return <code className={cn('code-inline', className)} {...props} />
}

export { Code }
