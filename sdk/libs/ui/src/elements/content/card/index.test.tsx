import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardHeader, CardBody, CardFooter } from './index'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies card class', () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('card')
  })

  it('applies card--interactive when interactive is true', () => {
    render(<Card data-testid="card" interactive>Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('card--interactive')
  })
})

describe('CardHeader', () => {
  it('applies card__header class', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>)
    expect(screen.getByTestId('header')).toHaveClass('card__header')
  })
})

describe('CardBody', () => {
  it('applies card__body class', () => {
    render(<CardBody data-testid="body">Body</CardBody>)
    expect(screen.getByTestId('body')).toHaveClass('card__body')
  })
})

describe('CardFooter', () => {
  it('applies card__footer class', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)
    expect(screen.getByTestId('footer')).toHaveClass('card__footer')
  })
})
