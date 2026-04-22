import '@lmthing/css/elements/overlays/dropdown/index.css'
import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../../lib/utils'

function Dropdown(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root {...props} />
}

function DropdownTrigger({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      className={cn('dropdown__trigger', className)}
      {...props}
    />
  )
}

function DropdownContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn('dropdown__content', className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn('dropdown__item', className)}
      {...props}
    />
  )
}

function DropdownSeparator({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className="separator my-1" {...props} />
}

export { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator }
