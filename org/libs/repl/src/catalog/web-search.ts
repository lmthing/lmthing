/**
 * Web Search Catalog Module
 *
 * Provides web search functionality for agents using DuckDuckGo HTML API.
 * No API key required — uses public search results.
 */

import type { CatalogFunction } from './types';

/**
 * Web search result.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Web search response.
 */
export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  totalResults: number;
}

/**
 * Perform a web search using DuckDuckGo HTML API.
 *
 * @param query — Search query
 * @param maxResults — Maximum number of results (default: 10)
 * @returns Search results with titles, URLs, and snippets
 */
export async function webSearch(
  query: string,
  maxResults = 10,
): Promise<WebSearchResponse> {
  const url = new URL('https://html.duckduckgo.com/html/');
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; THING-Agent/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Web search failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const results = parseDuckDuckGoResults(html, maxResults);

  return {
    results,
    query,
    totalResults: results.length,
  };
}

/**
 * Parse DuckDuckGo HTML search results.
 */
function parseDuckDuckGoResults(html: string, maxResults: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // DuckDuckGo uses specific CSS classes for results
  // This is a simple regex-based parser
  const resultRegex = /<class="[^"]*result__a[^"]*"[^>]*>.*?<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__url"[^>]*>(.*?)<\/a>.*?<class="result__snippet">.*?<class="result__snippet"[^>]*>(.*?)<\/class>/gs;

  let match;
  let count = 0;

  while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
    const [, url, titleHtml, urlText, snippet] = match;

    // Clean up HTML entities
    const title = titleHtml.replace(/<[^>]+>/g, '').trim();
    const cleanSnippet = snippet.replace(/<[^>]+>/g, '').trim();

    if (title && url) {
      results.push({
        title: decodeHtml(title),
        url: decodeHtml(url),
        snippet: decodeHtml(cleanSnippet),
      });
      count++;
    }
  }

  // If regex parsing fails, try alternative simpler approach
  if (results.length === 0) {
    const simpleRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>.*?<[^>]*class="[^"]*snippet[^"]*"[^>]*>([^<]+)</gs;
    let simpleMatch;
    let simpleCount = 0;

    while ((simpleMatch = simpleRegex.exec(html)) !== null && simpleCount < maxResults) {
      const [, url, title, snippet] = simpleMatch;
      if (title && url && !url.startsWith('/')) {
        results.push({
          title: decodeHtml(title.trim()),
          url: decodeHtml(url),
          snippet: decodeHtml(snippet.trim()),
        });
        simpleCount++;
      }
    }
  }

  return results;
}

/**
 * Decode HTML entities.
 */
export function decodeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };

  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Format web search results for display.
 */
export function formatWebSearchResults(response: WebSearchResponse): string {
  if (response.results.length === 0) {
    return `No results found for "${response.query}"`;
  }

  let output = `Search results for "${response.query}":\n\n`;

  for (let i = 0; i < response.results.length; i++) {
    const result = response.results[i];
    output += `${i + 1}. ${result.title}\n`;
    output += `   ${result.url}\n`;
    output += `   ${result.snippet}\n\n`;
  }

  return output;
}

/**
 * Web search catalog function.
 * Register this in the catalog to make webSearch() available to agents.
 */
export const webSearchFunction: CatalogFunction = {
  name: 'webSearch',
  description: 'Search the web for information using DuckDuckGo. Returns titles, URLs, and snippets.',
  signature: '(query: string, maxResults?: number): Promise<WebSearchResponse>',
  fn: async (...args: unknown[]) => {
    const query = args[0] as string;
    const maxResults = (args[1] as number) ?? 10;
    return await webSearch(query, maxResults);
  },
};

/**
 * Format search results as Markdown.
 */
export const formatSearchResultsFunction: CatalogFunction = {
  name: 'formatSearchResults',
  description: 'Format web search results as readable Markdown text.',
  signature: '(response: WebSearchResponse): string',
  fn: (...args: unknown[]) => {
    const response = args[0] as WebSearchResponse;
    return formatWebSearchResults(response);
  },
};
