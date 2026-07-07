import React from 'react';

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'code'; lines: string[] }
  | { type: 'p'; text: string };

const ORDERED = /^(\d+)[.)]\s+(.*)$/;
const UNORDERED = /^[-*]\s+(.*)$/;

function parseBlocks(markdown: string): Block[] {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushUl = () => {
    if (ul.length) {
      blocks.push({ type: 'ul', items: ul });
      ul = [];
    }
  };
  const flushOl = () => {
    if (ol.length) {
      blocks.push({ type: 'ol', items: ol });
      ol = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push({ type: 'quote', lines: quote });
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushUl();
    flushOl();
    flushQuote();
  };

  let inCode = false;
  let codeLines: string[] = [];

  for (const rawLine of lines) {
    // Fenced code blocks — preserve verbatim, ignore markdown inside.
    if (rawLine.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', lines: codeLines });
        codeLines = [];
        inCode = false;
      } else {
        flushAll();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
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
      quote.push(line.slice(2));
      continue;
    }

    const orderedMatch = line.match(ORDERED);
    if (orderedMatch) {
      flushParagraph();
      flushUl();
      flushQuote();
      ol.push(orderedMatch[2]);
      continue;
    }

    const unorderedMatch = line.match(UNORDERED);
    if (unorderedMatch) {
      flushParagraph();
      flushOl();
      flushQuote();
      ul.push(unorderedMatch[1]);
      continue;
    }

    flushUl();
    flushOl();
    flushQuote();
    paragraph.push(line);
  }

  if (inCode && codeLines.length) blocks.push({ type: 'code', lines: codeLines });
  flushAll();

  return blocks;
}

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

// Order matters: code first (opaque), then links, then bold, then italic.
const INLINE = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)/g;

function tokenizeInline(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('[')) {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push({ type: 'link', value: linkMatch[1], href: linkMatch[2] });
      } else {
        tokens.push({ type: 'text', value: raw });
      }
    } else if (raw.startsWith('**')) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('__')) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('*')) {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    } else if (raw.startsWith('_')) {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

/** Render inline markdown (bold/italic/code/link) to React nodes. */
export function renderInline(text: string, keyPrefix = ''): React.ReactNode[] {
  return tokenizeInline(text ?? '').map((token, i) => {
    const key = `${keyPrefix}${i}`;
    if (token.type === 'bold') {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {token.value}
        </strong>
      );
    }
    if (token.type === 'italic') {
      return (
        <em key={key} className="italic">
          {token.value}
        </em>
      );
    }
    if (token.type === 'code') {
      return (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.value}
        </code>
      );
    }
    if (token.type === 'link') {
      return (
        <a
          key={key}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {token.value}
        </a>
      );
    }
    return <React.Fragment key={key}>{token.value}</React.Fragment>;
  });
}

export function MarkdownBody({ source }: { source: string }) {
  const blocks = parseBlocks(source ?? '');

  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">No content.</p>;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocks.map((block, i) => {
        if (block.type === 'h1') {
          return (
            <h1 key={i} className="text-xl font-bold text-foreground">
              {renderInline(block.text, `${i}-`)}
            </h1>
          );
        }
        if (block.type === 'h2') {
          return (
            <h2 key={i} className="text-lg font-bold text-foreground">
              {renderInline(block.text, `${i}-`)}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3 key={i} className="text-base font-semibold text-foreground">
              {renderInline(block.text, `${i}-`)}
            </h3>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${i}-${j}-`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${i}-${j}-`)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'quote') {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-border pl-3 italic text-muted-foreground"
            >
              {block.lines.map((line, j) => (
                <p key={j}>{renderInline(line, `${i}-${j}-`)}</p>
              ))}
            </blockquote>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground"
            >
              <code>{block.lines.join('\n')}</code>
            </pre>
          );
        }
        return (
          <p key={i} className="leading-relaxed text-foreground">
            {renderInline(block.text, `${i}-`)}
          </p>
        );
      })}
    </div>
  );
}
