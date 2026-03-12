import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from './index'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies btn class', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn')
  })

  it('applies btn--primary by default', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--primary')
  })

  it('applies variant class', () => {
    render(<Button variant="ghost">Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--ghost')
  })

  it('applies size class', () => {
    render(<Button size="sm">Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--sm')
  })

  it('renders as child element when asChild is true', () => {
    render(<Button asChild><a href="#">Link</a></Button>)
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument()
  })

  it('forwards disabled prop', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
