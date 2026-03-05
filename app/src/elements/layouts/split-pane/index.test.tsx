import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SplitPane, SplitPanePrimary, SplitPaneSecondary } from './index'

describe('SplitPane', () => {
  it('renders children', () => {
    render(<SplitPane>Content</SplitPane>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies split-pane class', () => {
    render(<SplitPane data-testid="pane">Content</SplitPane>)
    expect(screen.getByTestId('pane')).toHaveClass('split-pane')
  })
})

describe('SplitPanePrimary', () => {
  it('applies split-pane__primary class', () => {
    render(<SplitPanePrimary data-testid="primary">Primary</SplitPanePrimary>)
    expect(screen.getByTestId('primary')).toHaveClass('split-pane__primary')
  })
})

describe('SplitPaneSecondary', () => {
  it('applies split-pane__secondary class', () => {
    render(<SplitPaneSecondary data-testid="secondary">Secondary</SplitPaneSecondary>)
    expect(screen.getByTestId('secondary')).toHaveClass('split-pane__secondary')
  })
})
