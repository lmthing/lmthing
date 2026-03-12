import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Separator } from './index'

describe('Separator', () => {
  it('renders a separator element', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies separator class', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toHaveClass('separator')
  })

  it('applies separator--vertical for vertical orientation', () => {
    const { container } = render(<Separator vertical />)
    expect(container.firstChild).toHaveClass('separator--vertical')
  })

  it('applies separator--vertical when orientation is vertical', () => {
    const { container } = render(<Separator orientation="vertical" />)
    expect(container.firstChild).toHaveClass('separator--vertical')
  })
})
