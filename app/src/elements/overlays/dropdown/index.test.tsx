import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from './index'

describe('Dropdown', () => {
  it('renders the trigger', () => {
    render(
      <Dropdown>
        <DropdownTrigger>Options</DropdownTrigger>
        <DropdownContent>
          <DropdownItem>Edit</DropdownItem>
        </DropdownContent>
      </Dropdown>
    )
    expect(screen.getByText('Options')).toBeInTheDocument()
  })

  it('applies dropdown__trigger class', () => {
    render(
      <Dropdown>
        <DropdownTrigger data-testid="trigger">Options</DropdownTrigger>
        <DropdownContent>
          <DropdownItem>Edit</DropdownItem>
        </DropdownContent>
      </Dropdown>
    )
    expect(screen.getByTestId('trigger')).toHaveClass('dropdown__trigger')
  })

  it('opens dropdown on trigger click and shows items', async () => {
    render(
      <Dropdown>
        <DropdownTrigger>Options</DropdownTrigger>
        <DropdownContent>
          <DropdownItem>Edit</DropdownItem>
          <DropdownItem>Delete</DropdownItem>
        </DropdownContent>
      </Dropdown>
    )
    await userEvent.click(screen.getByText('Options'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })
})
