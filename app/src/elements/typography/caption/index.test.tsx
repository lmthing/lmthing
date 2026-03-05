import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Caption } from './index'

describe('Caption', () => {
  it('renders children', () => {
    render(<Caption>Some hint text</Caption>)
    expect(screen.getByText('Some hint text')).toBeInTheDocument()
  })

  it('applies caption class', () => {
    render(<Caption data-testid="caption">Hint</Caption>)
    expect(screen.getByTestId('caption')).toHaveClass('caption')
  })

  it('applies caption--muted when muted is true', () => {
    render(<Caption data-testid="caption" muted>Hint</Caption>)
    expect(screen.getByTestId('caption')).toHaveClass('caption--muted')
  })
})
