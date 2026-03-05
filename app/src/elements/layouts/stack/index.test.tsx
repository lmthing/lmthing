import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Stack } from './index'

describe('Stack', () => {
  it('renders children', () => {
    render(<Stack>Content</Stack>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies stack class', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('stack')
  })

  it('applies stack--row when row is true', () => {
    render(<Stack data-testid="stack" row>Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('stack--row')
  })

  it('applies gap classes', () => {
    render(<Stack data-testid="stack" gap="md">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('stack--gap-md')
  })

  it('applies stack--gap-sm', () => {
    render(<Stack data-testid="stack" gap="sm">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('stack--gap-sm')
  })

  it('applies stack--gap-lg', () => {
    render(<Stack data-testid="stack" gap="lg">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('stack--gap-lg')
  })
})
