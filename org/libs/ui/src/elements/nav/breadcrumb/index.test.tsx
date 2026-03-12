import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Breadcrumb } from './index'

const segments = [
  { label: 'Home' },
  { label: 'Studio' },
  { label: 'Space' },
]

describe('Breadcrumb', () => {
  it('renders all segments', () => {
    render(<Breadcrumb segments={segments} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
    expect(screen.getByText('Space')).toBeInTheDocument()
  })

  it('applies breadcrumb class', () => {
    render(<Breadcrumb segments={segments} />)
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toHaveClass('breadcrumb')
  })

  it('renders separators between segments', () => {
    render(<Breadcrumb segments={segments} />)
    const separators = document.querySelectorAll('.breadcrumb__separator')
    expect(separators).toHaveLength(2)
  })

  it('marks last segment as current page', () => {
    render(<Breadcrumb segments={segments} />)
    expect(screen.getByText('Space')).toHaveAttribute('aria-current', 'page')
  })
})
