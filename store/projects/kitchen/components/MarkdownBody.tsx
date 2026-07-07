import React from 'react';

/**
 * A small, dependency-free markdown renderer for recipe instructions and
 * agent-written suggestion bodies. Supports headings, ordered + unordered
 * lists, blockquotes, fenced code blocks, and inline bold / italic /
 * `code` / [links](url).
 */

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'p'; text: string };

const ORDERED_RE = /^(\d+)[.)]\s+(.*)$/;

function parseBlocks(markdown: string): Block[] {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let ulItems: string[] = [];
  let olItems: string[] = [];
  let quoteLines: string[] = [];
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushUl = () => {
    if (ulItems.length) {
      blocks.push({ type: 'ul', items: ulItems });
      ulItems = [];
    }
  };
  const flushOl = () => {
    if (olItems.length) {
      blocks.push({ type: 'ol', items: olItems });
      olItems = [];
    }
  };
  const flushQuote = () => {
    if (quoteLines.length) {
      blocks.push({ type: 'quote', text: quoteLines.join(' ').trim() });
      quoteLines = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushUl();
    flushOl();
    flushQuote();
  };

  for (const rawLine of lines) {
    // Fenced code blocks — capture verbatim until the closing fence.
    if (rawLine.trim().startsWith('```')) {
      if (codeLines === null) {
        flushAll();
        codeLines = [];
      } else {
        blocks.push({ type: 'code', text: codeLines.join('\n') });
        codeLines = null;
      }
      continue;
    }
    if (codeLines !== null) {
      codeLines.push(rawLine);
      continue;
    }

    const line = rawLine.trim();

    if (line === '') {
      flushAll();
      continue;
    }

    if (line.startsWith('### ')) {
      flushAll();
      blocks.push({ type: 'h3', text: line.slice(4) });
      continue;
    }
    if (line.startsWith('## ')) {
      flushAll();
      blocks.push({ type: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('# ')) {
      flushAll();
      blocks.push({ type: 'h1', text: line.slice(2) });
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph();
      flushUl();
      flushOl();
      quoteLines.push(line.slice(2));
      continue;
    }

    const ordered = line.match(ORDERED_RE);
    if (ordered) {
      flushParagraph();
      flushUl();
      flushQuote();
      olItems.push(ordered[2]);
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      flushOl();
      flushQuote();
      ulItems.push(line.slice(2));
      continue;
    }

    flushUl();
    flushOl();
    flushQuote();
    paragraph.push(line);
  }

  if (codeLines !== null) {
    blocks.push({ type: 'code', text: codeLines.join('\n') });
  }
  flushAll();

  return blocks;
}

const TOKEN_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

/** Render inline bold / italic / code / links inside a run of text. */
export function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const src = text ?? '';

  for (const match of src.matchAll(TOKEN_RE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) {
      nodes.push(src.slice(last, start));
    }

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }

    last = start + token.length;
  }

  if (last < src.length) {
    nodes.push(src.slice(last));
  }

  return nodes;
}

export function MarkdownBody({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown ?? '');

  if (blocks.length === 0) {
    return <p className="text-muted-foreground">No content.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === 'h1') {
          return (
            <h1 key={i} className="text-2xl font-bold text-foreground">
              {renderInline(block.text)}
            </h1>
          );
        }
        if (block.type === 'h2') {
          return (
            <h2 key={i} className="text-xl font-bold text-foreground">
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3 key={i} className="text-lg font-bold text-foreground">
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-6 text-foreground">
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol
              key={i}
              className="list-decimal space-y-2 pl-6 text-foreground marker:font-semibold marker:text-muted-foreground"
            >
              {block.items.map((item, j) => (
                <li key={j} className="pl-1 leading-relaxed">
                  {renderInline(item)}
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === 'quote') {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-border pl-4 italic text-muted-foreground"
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground"
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        return (
          <p key={i} className="leading-relaxed text-foreground">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
