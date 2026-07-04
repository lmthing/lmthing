import React from 'react';
import { MarkdownBody } from './MarkdownBody';

export interface NewsletterLike {
  id: string;
  digestId: string;
  subject: string;
  body: string;
  sentAt?: string | null;
  createdAt?: string;
}

export function NewsletterView({ newsletter }: { newsletter: NewsletterLike }) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="font-bold text-foreground">{newsletter.subject}</h2>
        {newsletter.sentAt ? (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Sent {new Date(newsletter.sentAt).toLocaleString()}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Not sent
          </span>
        )}
      </div>
      <MarkdownBody markdown={newsletter.body ?? ''} />
    </div>
  );
}
