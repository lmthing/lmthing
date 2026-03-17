import { writeFile } from 'node:fs/promises'
import type { CatalogModule } from './types'

interface RequestOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

const fetchModule: CatalogModule = {
  id: 'fetch',
  description: 'HTTP request utilities',
  functions: [
    {
      name: 'httpGet',
      description: 'GET request, auto-parses JSON',
      signature: '(url: string, headers?: Record<string, string>) => Promise<any>',
      fn: async (url: unknown, headers?: unknown) => {
        const res = await fetch(url as string, { headers: headers as Record<string, string> })
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('json')) return res.json()
        return res.text()
      },
    },
    {
      name: 'httpPost',
      description: 'POST with JSON body',
      signature: '(url: string, body: any, headers?: Record<string, string>) => Promise<any>',
      fn: async (url: unknown, body: unknown, headers?: unknown) => {
        const res = await fetch(url as string, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
          body: JSON.stringify(body),
        })
        const ct = res.headers.get('content-type') ?? ''
        if (ct.includes('json')) return res.json()
        return res.text()
      },
    },
    {
      name: 'httpPut',
      description: 'PUT with JSON body',
      signature: '(url: string, body: any, headers?: Record<string, string>) => Promise<any>',
      fn: async (url: unknown, body: unknown, headers?: unknown) => {
        const res = await fetch(url as string, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
          body: JSON.stringify(body),
        })
        const ct = res.headers.get('content-type') ?? ''
        if (ct.includes('json')) return res.json()
        return res.text()
      },
    },
    {
      name: 'httpDelete',
      description: 'DELETE request',
      signature: '(url: string, headers?: Record<string, string>) => Promise<any>',
      fn: async (url: unknown, headers?: unknown) => {
        const res = await fetch(url as string, {
          method: 'DELETE',
          headers: headers as Record<string, string>,
        })
        const ct = res.headers.get('content-type') ?? ''
        if (ct.includes('json')) return res.json()
        return res.text()
      },
    },
    {
      name: 'httpRequest',
      description: 'Full control HTTP request',
      signature: '(options: RequestOptions) => Promise<{ status: number, headers: Record<string, string>, body: any }>',
      fn: async (options: unknown) => {
        const opts = options as RequestOptions
        const res = await fetch(opts.url, {
          method: opts.method ?? 'GET',
          headers: opts.headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined,
        })
        const ct = res.headers.get('content-type') ?? ''
        const body = ct.includes('json') ? await res.json() : await res.text()
        const headers: Record<string, string> = {}
        res.headers.forEach((v, k) => { headers[k] = v })
        return { status: res.status, headers, body }
      },
    },
    {
      name: 'fetchPage',
      description: 'Fetch webpage, extract readable text',
      signature: '(url: string) => Promise<{ title: string, text: string, links: string[] }>',
      fn: async (url: unknown) => {
        const res = await fetch(url as string)
        const html = await res.text()
        // Simple HTML text extraction
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
        const title = titleMatch ? titleMatch[1].trim() : ''
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const links: string[] = []
        const linkRegex = /href=["']([^"']+)["']/gi
        let match
        while ((match = linkRegex.exec(html)) !== null) {
          links.push(match[1])
        }
        return { title, text: text.slice(0, 10000), links: [...new Set(links)] }
      },
    },
    {
      name: 'downloadFile',
      description: 'Download to local file',
      signature: '(url: string, dest: string) => Promise<{ size: number }>',
      fn: async (url: unknown, dest: unknown) => {
        const res = await fetch(url as string)
        const buffer = Buffer.from(await res.arrayBuffer())
        await writeFile(dest as string, buffer)
        return { size: buffer.length }
      },
    },
  ],
}

export default fetchModule
