import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './index'

describe('Sheet', () => {
  it('renders the trigger', () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Sheet Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('opens sheet on trigger click', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Sheet Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Sheet Title')).toBeInTheDocument()
  })

  it('applies sheet class to content', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent data-testid="sheet">
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('sheet')).toHaveClass('sheet')
  })

  it('applies sheet--right by default', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent data-testid="sheet">
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('sheet')).toHaveClass('sheet--right')
  })
})
