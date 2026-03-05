import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Code } from './index'

describe('Code', () => {
  it('renders inline code by default', () => {
    render(<Code>const x = 1</Code>)
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
  })

  it('applies code-inline class by default', () => {
    render(<Code data-testid="code">snippet</Code>)
    expect(screen.getByTestId('code')).toHaveClass('code-inline')
  })

  it('renders in a pre element when block is true', () => {
    const { container } = render(<Code block>const x = 1</Code>)
    expect(container.querySelector('pre')).toHaveClass('code-block')
  })
})
