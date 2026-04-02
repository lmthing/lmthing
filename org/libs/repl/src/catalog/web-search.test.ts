/**
 * Tests for Web Search functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { webSearch, formatWebSearchResults, decodeHtml } from './web-search'
import type { WebSearchResponse } from './web-search'

// ── Mock fetch for testing ───────────────────────────────────────────────────

const mockFetch = vi.fn()

beforeEach(() => {
  global.fetch = mockFetch
})

afterEach(() => {
  mockFetch.mockReset()
})

// ── webSearch ─────────────────────────────────────────────────────────────────

describe('webSearch', () => {
  it('throws error when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Web search failed: Network error'))

    await expect(webSearch('test query')).rejects.toThrow()
  })

  it('returns search results structure', async () => {
    const mockHtml = `
      <html><body>
        <div class="result__a">
          <a class="result__a" href="https://example.com/page1">Page 1 Title</a>
          <a class="result__url">example.com</a>
          <a class="result__snippet">This is a snippet for page 1.</a>
        </div>
      </body></html>
    `
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockHtml,
    } as unknown as Response)

    const result = await webSearch('test query', 5)

    expect(result.query).toBe('test query')
    expect(result.results).toBeInstanceOf(Array)
    expect(result.totalResults).toBe(result.results.length)
  })

  it('parses results from DuckDuckGo HTML format', async () => {
    const mockHtml = `
      <html><body>
        <div class="result__a">
          <a class="result__a" href="https://test.com/page">Test Page</a>
          <a class="result__url">test.com</a>
          <a class="result__snippet">Test description here</a>
        </div>
      </body></html>
    `
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockHtml,
    } as Response)

    const result = await webSearch('test', 5)

    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0]).toHaveProperty('title')
    expect(result.results[0]).toHaveProperty('url')
    expect(result.results[0]).toHaveProperty('snippet')
  })

  it('respects maxResults parameter', async () => {
    const mockHtml = `
      <html><body>
        <div class="result__a"><a href="url1">Result 1</a></div>
        <div class="result__a"><a href="url2">Result 2</a></div>
        <div class="result__a"><a href="url3">Result 3</a></div>
      </body></html>
    `
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockHtml,
    } as Response)

    const result = await webSearch('test', 2)

    expect(result.results.length).toBeLessThanOrEqual(2)
  })

  it('handles empty results gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>No results found</body></html>',
    } as Response)

    const result = await webSearch('test', 5)

    expect(result.results).toEqual([])
    expect(result.totalResults).toBe(0)
  })

  it('encodes query parameters properly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body></body></html>',
    } as unknown as Response)

    await webSearch('search with spaces', 5)

    const fetchCall = mockFetch.mock.calls[0]
    const url = fetchCall[0]
    // URL encoding uses '+' for spaces in query strings
    expect(url).toContain('search+with+spaces')
  })
})

// ── formatWebSearchResults ─────────────────────────────────────────────────────

describe('formatWebSearchResults', () => {
  it('formats empty results with message', () => {
    const response: WebSearchResponse = {
      query: 'test',
      results: [],
      totalResults: 0,
    }

    const result = formatWebSearchResults(response)

    expect(result).toContain('No results found')
    expect(result).toContain('test')
  })

  it('formats single result correctly', () => {
    const response: WebSearchResponse = {
      query: 'test query',
      results: [
        {
          title: 'Test Title',
          url: 'https://example.com/test',
          snippet: 'Test snippet description',
        },
      ],
      totalResults: 1,
    }

    const result = formatWebSearchResults(response)

    expect(result).toContain('Search results for "test query"')
    expect(result).toContain('1. Test Title')
    expect(result).toContain('https://example.com/test')
    expect(result).toContain('Test snippet description')
  })

  it('formats multiple results with numbering', () => {
    const response: WebSearchResponse = {
      query: 'test',
      results: [
        { title: 'Result 1', url: 'url1', snippet: 'Snippet 1' },
        { title: 'Result 2', url: 'url2', snippet: 'Snippet 2' },
        { title: 'Result 3', url: 'url3', snippet: 'Snippet 3' },
      ],
      totalResults: 3,
    }

    const result = formatWebSearchResults(response)

    expect(result).toContain('1. Result 1')
    expect(result).toContain('2. Result 2')
    expect(result).toContain('3. Result 3')
  })

  it('formats results in readable Markdown format', () => {
    const response: WebSearchResponse = {
      query: 'query',
      results: [
        {
          title: 'Test',
          url: 'https://example.com',
          snippet: 'Description',
        },
      ],
      totalResults: 1,
    }

    const result = formatWebSearchResults(response)

    expect(result).toContain('Search results for')
    expect(result).toMatch(/\n\n\d+\./) // Has numbered list
  })
})

// ── decodeHtml ───────────────────────────────────────────────────────────────

describe('decodeHtml', () => {
  it('decodes HTML entities', () => {
    expect(decodeHtml('Test &amp; Co')).toBe('Test & Co')
    expect(decodeHtml('&lt;script&gt;')).toBe('<script>')
    expect(decodeHtml('&quot;quoted&quot;')).toBe('"quoted"')
  })

  it('handles multiple entities in one string', () => {
    const result = decodeHtml('&lt;div&gt;&amp;&quot;')
    expect(result).toBe('<div>&"')
  })

  it('handles unknown entities by leaving them intact', () => {
    const result = decodeHtml('Text &unknown; more')
    expect(result).toBe('Text &unknown; more')
  })

  it('handles empty strings', () => {
    expect(decodeHtml('')).toBe('')
  })

  it('handles strings without entities', () => {
    expect(decodeHtml('Plain text')).toBe('Plain text')
  })
})

// ── Error Handling ───────────────────────────────────────────────────────────

describe('Error Handling', () => {
  it('handles malformed HTML gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'not even html',
    } as Response)

    const result = await webSearch('test', 5)

    // Should return empty results rather than throw
    expect(Array.isArray(result.results)).toBe(true)
  })

  it('handles timeout errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'))

    await expect(webSearch('test')).rejects.toThrow()
  })
})
