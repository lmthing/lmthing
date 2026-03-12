import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Select, SelectOption } from './index'

describe('Select', () => {
  it('renders a select element', () => {
    render(
      <Select aria-label="choose">
        <SelectOption value="a">Option A</SelectOption>
      </Select>
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('applies select__trigger class to the select element', () => {
    render(<Select aria-label="choose" data-testid="select" />)
    expect(screen.getByTestId('select')).toHaveClass('select__trigger')
  })

  it('renders options', () => {
    render(
      <Select aria-label="choose">
        <SelectOption value="a">Alpha</SelectOption>
        <SelectOption value="b">Beta</SelectOption>
      </Select>
    )
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument()
  })

  it('forwards disabled prop', () => {
    render(<Select aria-label="choose" disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
