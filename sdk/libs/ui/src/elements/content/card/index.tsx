import '@lmthing/css/elements/content/card/index.css'
import * as React from 'react'
import { cn } from '../../../lib/utils'

export interface CardProps extends React.ComponentProps<'div'> {
  interactive?: boolean
}

function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn('card', interactive && 'card--interactive', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('card__header', className)} {...props} />
}

function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('card__body', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('card__footer', className)} {...props} />
}

export { Card, CardHeader, CardBody, CardFooter }
