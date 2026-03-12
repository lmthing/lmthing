import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Heading } from './index'

describe('Heading', () => {
  it('renders an h2 by default', () => {
    render(<Heading>Title</Heading>)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('renders correct heading tag for level', () => {
    render(<Heading level={1}>Title</Heading>)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('applies heading-N class based on level', () => {
    render(<Heading level={3} data-testid="heading">Title</Heading>)
    expect(screen.getByTestId('heading')).toHaveClass('heading-3')
  })

  it('applies heading--muted when muted is true', () => {
    render(<Heading data-testid="heading" muted>Title</Heading>)
    expect(screen.getByTestId('heading')).toHaveClass('heading--muted')
  })
})
