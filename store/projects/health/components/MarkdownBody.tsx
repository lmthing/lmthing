import React from 'react';

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'code'; code: string }
  | { type: 'hr' }
  | { type: 'p'; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let quoteLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
      listItems = [];
    }
  };
  const flushQuote = () => {
    if (quoteLines.length) {
      blocks.push({ type: 'quote', lines: quoteLines });
      quoteLines = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Fenced code block — consume until the closing fence.
    if (line.startsWith('```')) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', code: code.join('\n') });
      continue;
    }

    if (line === '') {
      flushAll();
      continue;
    }

    if (line === '---' || line === '***' || line === '___') {
      flushAll();
      blocks.push({ type: 'hr' });
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      quoteLines.push(line.slice(2));
      continue;
    }
    if (line === '>') {
      flushParagraph();
      flushList();
      quoteLines.push('');
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

    const ordered = /^\d+\.\s/.test(line);
    if (line.startsWith('- ') || line.startsWith('* ') || ordered) {
      flushParagraph();
      flushQuote();
      listOrdered = ordered;
      listItems.push(ordered ? line.replace(/^\d+\.\s/, '') : line.slice(2));
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

/** Render inline markdown — `**bold**`, `*italic*`/`_italic_`, `` `code` ``, `[text](url)`. */
function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  // Single tokenizer pass over the recognized inline patterns.
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${n++}`;
    if ((tok.startsWith('**') && tok.endsWith('**')) || (tok.startsWith('__') && tok.endsWith('__'))) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('`') && tok.endsWith('`')) {
      out.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (linkMatch) {
        out.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        out.push(tok);
      }
    } else {
      out.push(
        <em key={key} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
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
            <h1 key={i} className="text-2xl font-bold tracking-tight text-foreground">
              {renderInline(block.text, `h1${i}`)}
            </h1>
          );
        }
        if (block.type === 'h2') {
          return (
            <h2 key={i} className="mt-2 text-xl font-bold tracking-tight text-foreground">
              {renderInline(block.text, `h2${i}`)}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3 key={i} className="text-lg font-semibold text-foreground">
              {renderInline(block.text, `h3${i}`)}
            </h3>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={i}
              className={`space-y-1.5 pl-6 text-foreground marker:text-muted-foreground ${
                block.ordered ? 'list-decimal' : 'list-disc'
              }`}
            >
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(item, `li${i}-${j}`)}
                </li>
              ))}
            </ListTag>
          );
        }
        if (block.type === 'quote') {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-primary bg-muted py-2 pl-4 pr-3 text-foreground italic"
            >
              {block.lines.map((ln, j) => (
                <p key={j} className="leading-relaxed">
                  {renderInline(ln, `q${i}-${j}`)}
                </p>
              ))}
            </blockquote>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm text-foreground"
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        if (block.type === 'hr') {
          return <hr key={i} className="border-border" />;
        }
        return (
          <p key={i} className="leading-relaxed text-foreground">
            {renderInline(block.text, `p${i}`)}
          </p>
        );
      })}
    </div>
  );
}

export default MarkdownBody;
