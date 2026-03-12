import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Page, PageHeader, PageBody } from './index'

describe('Page', () => {
  it('renders children', () => {
    render(<Page>Page content</Page>)
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('applies page class', () => {
    render(<Page data-testid="page">Content</Page>)
    expect(screen.getByTestId('page')).toHaveClass('page')
  })

  it('applies page--full when full is true', () => {
    render(<Page data-testid="page" full>Content</Page>)
    expect(screen.getByTestId('page')).toHaveClass('page--full')
  })
})

describe('PageHeader', () => {
  it('applies page__header class', () => {
    render(<PageHeader data-testid="header">Header</PageHeader>)
    expect(screen.getByTestId('header')).toHaveClass('page__header')
  })
})

describe('PageBody', () => {
  it('applies page__body class', () => {
    render(<PageBody data-testid="body">Body</PageBody>)
    expect(screen.getByTestId('body')).toHaveClass('page__body')
  })
})
