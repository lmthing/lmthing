import '@lmthing/css/elements/content/avatar/index.css'
import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '../../../lib/utils'

export type AvatarSize = 'default' | 'sm' | 'lg'

export interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  size?: AvatarSize
}

function Avatar({ className, size = 'default', ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'avatar',
        size === 'sm' && 'avatar--sm',
        size === 'lg' && 'avatar--lg',
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('avatar__image', className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('avatar__fallback', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
