import React from 'react';
import { Chat } from '@app/runtime';
import { Icon } from '../components/icons';

const EXAMPLES: { group: string; items: string[] }[] = [
  {
    group: 'Ask across your feed',
    items: [
      'What happened in AI regulation this week?',
      'Why am I seeing so much about fusion energy?',
      "What's the latest on the EU AI Act?",
    ],
  },
  {
    group: 'Tune what you read',
    items: ['Follow small modular reactors, mute crypto.', 'Turn up how much I see about biotech.'],
  },
  {
    group: 'Curate & research',
    items: [
      'Make a collection of everything on the EU AI Act.',
      'Give me a briefing on grid-scale batteries.',
      "Watch for anything about my competitor Acme.",
    ],
  },
];

export default function Assistant() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon name="sparkle" className="h-5 w-5" filled />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your app-wide concierge. Ask about anything in your feed, tune your topics, or ask for a
            collection, briefing, or deep-dive — the Editor grounds every answer in your real
            articles and delegates the heavy work to the newsroom desks. Press{' '}
            <kbd className="rounded border border-border bg-muted px-1 text-[0.7rem] font-semibold text-foreground">
              ⌘K
            </kbd>{' '}
            anywhere to jump back here.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {EXAMPLES.map((col) => (
          <div key={col.group} className="space-y-2 rounded-xl border border-border bg-card p-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
              {col.group}
            </p>
            <ul className="space-y-1.5">
              {col.items.map((ex) => (
                <li key={ex} className="text-sm leading-snug text-foreground">
                  "{ex}"
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-3">
        <Chat agent="assistant/editor" className="min-h-[26rem]" />
      </section>

      <p className="text-center text-xs text-muted-foreground">
        The Editor confirms before anything destructive or budget-spending, and never invents a
        headline or fact.
      </p>
    </main>
  );
}
