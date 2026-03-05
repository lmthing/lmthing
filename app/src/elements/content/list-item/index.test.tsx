import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ListItem } from './index'

describe('ListItem', () => {
  it('renders children', () => {
    render(<ListItem>Item content</ListItem>)
    expect(screen.getByText('Item content')).toBeInTheDocument()
  })

  it('applies list-item class', () => {
    render(<ListItem data-testid="item">Content</ListItem>)
    expect(screen.getByTestId('item')).toHaveClass('list-item')
  })

  it('applies list-item--selected when selected is true', () => {
    render(<ListItem data-testid="item" selected>Content</ListItem>)
    expect(screen.getByTestId('item')).toHaveClass('list-item--selected')
  })

  it('renders label and meta when provided', () => {
    render(<ListItem label="My Label" meta="4 items" />)
    expect(screen.getByText('My Label')).toHaveClass('list-item__label')
    expect(screen.getByText('4 items')).toHaveClass('list-item__meta')
  })
})
