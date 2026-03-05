import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Panel, PanelHeader, PanelBody } from './index'

describe('Panel', () => {
  it('renders children', () => {
    render(<Panel>Panel content</Panel>)
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('applies panel class', () => {
    render(<Panel data-testid="panel">Content</Panel>)
    expect(screen.getByTestId('panel')).toHaveClass('panel')
  })

  it('applies panel--split when split is true', () => {
    render(<Panel data-testid="panel" split>Content</Panel>)
    expect(screen.getByTestId('panel')).toHaveClass('panel--split')
  })
})

describe('PanelHeader', () => {
  it('applies panel__header class', () => {
    render(<PanelHeader data-testid="header">Header</PanelHeader>)
    expect(screen.getByTestId('header')).toHaveClass('panel__header')
  })
})

describe('PanelBody', () => {
  it('applies panel__body class', () => {
    render(<PanelBody data-testid="body">Body</PanelBody>)
    expect(screen.getByTestId('body')).toHaveClass('panel__body')
  })
})
