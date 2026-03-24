/**
 * Example 8: Parallel web scraper with async()
 *
 * Demonstrates the async() global for fire-and-forget background tasks.
 * The agent scrapes multiple sites concurrently while continuing its main flow.
 * Background results appear in the next stop() payload as async_0, async_1, etc.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/08-async-scraper.tsx -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/08-async-scraper.tsx -m anthropic:claude-sonnet-4-20250514
 */

import React from 'react'

// ── Simulated scrape targets ──

interface ScrapeResult {
  url: string
  title: string
  wordCount: number
  links: string[]
  headings: string[]
  scrapedAt: string
}

interface PriceData {
  product: string
  price: number
  currency: string
  inStock: boolean
  rating: number
  reviews: number
}

const SITES: Record<string, ScrapeResult> = {
  'https://example.com/blog/ai-trends': {
    url: 'https://example.com/blog/ai-trends',
    title: 'Top AI Trends for 2026',
    wordCount: 2450,
    links: ['/blog/llm-guide', '/blog/agents-explained', '/about'],
    headings: ['Introduction', 'Trend 1: Agentic AI', 'Trend 2: Multimodal Models', 'Trend 3: On-Device AI', 'Conclusion'],
    scrapedAt: new Date().toISOString(),
  },
  'https://example.com/blog/typescript-tips': {
    url: 'https://example.com/blog/typescript-tips',
    title: '10 TypeScript Tips You Need',
    wordCount: 1800,
    links: ['/blog/react-patterns', '/blog/node-best-practices', '/docs'],
    headings: ['Why TypeScript?', 'Tip 1: Use const assertions', 'Tip 2: Discriminated unions', 'Tip 3: Template literals'],
    scrapedAt: new Date().toISOString(),
  },
  'https://example.com/blog/react-patterns': {
    url: 'https://example.com/blog/react-patterns',
    title: 'Modern React Patterns',
    wordCount: 3100,
    links: ['/blog/typescript-tips', '/blog/state-management', '/examples'],
    headings: ['Component Composition', 'Render Props vs Hooks', 'Server Components', 'Suspense Patterns'],
    scrapedAt: new Date().toISOString(),
  },
  'https://shop.example.com/headphones': {
    url: 'https://shop.example.com/headphones',
    title: 'Wireless Headphones Pro',
    wordCount: 450,
    links: ['/reviews', '/compare', '/cart'],
    headings: ['Product Details', 'Specifications', 'Reviews'],
    scrapedAt: new Date().toISOString(),
  },
  'https://shop.example.com/keyboard': {
    url: 'https://shop.example.com/keyboard',
    title: 'Mechanical Keyboard MK-7',
    wordCount: 620,
    links: ['/reviews', '/accessories', '/cart'],
    headings: ['Overview', 'Key Switches', 'Connectivity', 'Customer Reviews'],
    scrapedAt: new Date().toISOString(),
  },
}

const PRICES: Record<string, PriceData> = {
  'https://shop.example.com/headphones': { product: 'Wireless Headphones Pro', price: 149.99, currency: 'USD', inStock: true, rating: 4.5, reviews: 342 },
  'https://shop.example.com/keyboard': { product: 'Mechanical Keyboard MK-7', price: 89.99, currency: 'USD', inStock: false, rating: 4.8, reviews: 127 },
}

// ── React Components ──

export function ScrapeCard({ result }: { result: ScrapeResult }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 400, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>🔍 {result.title}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{result.url}</div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        <span style={{ marginRight: 16 }}>📝 {result.wordCount} words</span>
        <span>🔗 {result.links.length} links</span>
      </div>
      <div style={{ fontSize: 13, color: '#666' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Headings:</div>
        {result.headings.map((h, i) => <div key={i}>• {h}</div>)}
      </div>
    </div>
  )
}

export function PriceCard({ data }: { data: PriceData }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 320, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>🛒 {data.product}</div>
      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2d7d2d' }}>
        ${data.price.toFixed(2)}
      </div>
      <div style={{ marginTop: 8, fontSize: 14 }}>
        <span style={{ color: data.inStock ? '#2d7d2d' : '#d32f2f', fontWeight: 'bold' }}>
          {data.inStock ? '✅ In Stock' : '❌ Out of Stock'}
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: '#888' }}>
        ⭐ {data.rating}/5 ({data.reviews} reviews)
      </div>
    </div>
  )
}

export function SummaryTable({ results }: { results: ScrapeResult[] }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 560, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>📊 Scrape Summary</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Page</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Words</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Links</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Headings</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{r.title}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px' }}>{r.wordCount}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px' }}>{r.links.length}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px' }}>{r.headings.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
        Total: {results.reduce((s, r) => s + r.wordCount, 0)} words across {results.length} pages
      </div>
    </div>
  )
}

export function UrlPickerForm({ urls }: { urls: string[] }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
        Which URLs do you want to scrape? (comma-separated numbers)
      </label>
      {urls.map((url, i) => (
        <div key={i} style={{ fontSize: 14, color: '#444', marginBottom: 2 }}>
          {i + 1}. {url}
        </div>
      ))}
      <input name="selection" type="text" placeholder="e.g. 1,3,5" style={{ marginTop: 8, padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
    </div>
  )
}

// ── Functions (injected as globals) ──

/** Scrape a URL (simulated with 500ms delay) */
export async function scrape(url: string): Promise<ScrapeResult | null> {
  await new Promise(r => setTimeout(r, 500))
  return SITES[url] ?? null
}

/** Get price data for a product URL (simulated with 300ms delay) */
export async function getPrice(url: string): Promise<PriceData | null> {
  await new Promise(r => setTimeout(r, 300))
  return PRICES[url] ?? null
}

/** List all available URLs */
export function listUrls(): string[] {
  return Object.keys(SITES)
}

/** List product URLs (ones with price data) */
export function listProductUrls(): string[] {
  return Object.keys(PRICES)
}

// ── CLI config ──

export const replConfig = {
  instruct: `You are a web scraping assistant. You have tools to scrape pages and check prices.

IMPORTANT: Use async() to scrape multiple URLs in parallel instead of awaiting them one by one. This is much faster.

The function passed to async() must be an async function so that await works inside it:
  async(async () => { const r = await scrape(url1); await stop(r) })  // background
  async(async () => { const r = await scrape(url2); await stop(r) })  // background
  // continue other work, then call stop() to collect background results as async_0, async_1, etc.

When results come back:
- Use display(<ScrapeCard result={...} />) to show individual pages
- Use display(<SummaryTable results={[...]} />) for an overview
- Use display(<PriceCard data={...} />) for product prices
- Use ask(<UrlPickerForm urls={...} />) to let the user choose URLs

Start by listing available URLs, then scrape them in parallel using async().`,
  functionSignatures: `
  scrape(url: string): Promise<ScrapeResult | null> — Scrape a URL. Returns { url, title, wordCount, links[], headings[], scrapedAt } or null. Has ~500ms latency.
  getPrice(url: string): Promise<PriceData | null> — Get product price data. Returns { product, price, currency, inStock, rating, reviews } or null. Has ~300ms latency.
  listUrls(): string[] — List all available URLs
  listProductUrls(): string[] — List URLs that have price data

  ## React Components (use with display() and ask())
  <ScrapeCard result={ScrapeResult} /> — Display a single scrape result with title, word count, links, headings
  <PriceCard data={PriceData} /> — Display product price, stock status, and rating
  <SummaryTable results={ScrapeResult[]} /> — Table overview of multiple scrape results
  <UrlPickerForm urls={string[]} /> — Form to let the user choose which URLs to scrape (use with ask())
  `,
  maxTurns: 10,
}
