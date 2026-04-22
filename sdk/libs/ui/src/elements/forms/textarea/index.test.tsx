import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Textarea } from './index'

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('applies textarea class', () => {
    render(<Textarea data-testid="textarea" />)
    expect(screen.getByTestId('textarea')).toHaveClass('textarea')
  })

  it('applies textarea--sm when compact is true', () => {
    render(<Textarea data-testid="textarea" compact />)
    expect(screen.getByTestId('textarea')).toHaveClass('textarea--sm')
  })

  it('forwards disabled prop', () => {
    render(<Textarea data-testid="textarea" disabled />)
    expect(screen.getByTestId('textarea')).toBeDisabled()
  })
})
