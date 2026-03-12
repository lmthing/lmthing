import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './index'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies badge class', () => {
    render(<Badge data-testid="badge">Active</Badge>)
    expect(screen.getByTestId('badge')).toHaveClass('badge')
  })

  it('applies badge--primary for primary variant', () => {
    render(<Badge data-testid="badge" variant="primary">Active</Badge>)
    expect(screen.getByTestId('badge')).toHaveClass('badge--primary')
  })

  it('applies badge--muted for muted variant', () => {
    render(<Badge data-testid="badge" variant="muted">Draft</Badge>)
    expect(screen.getByTestId('badge')).toHaveClass('badge--muted')
  })

  it('applies badge--success for success variant', () => {
    render(<Badge data-testid="badge" variant="success">Done</Badge>)
    expect(screen.getByTestId('badge')).toHaveClass('badge--success')
  })
})
