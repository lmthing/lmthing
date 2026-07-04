---
title: Personalizer
defaultAction: learn
actions:
  - id: learn
    label: Learn from engagement
    description: Nudge one topic's weight from a single new reading event.
  - id: rescore
    label: Rescore feed
    description: Recompute every article's score from the current topic weights.
knowledge:
  - editorial/ranking-and-personalization
functions:
  - scoreByTopics
  - summarizeEngagement
  - computeTopicWeights
components:
  - TopicWeightBadge
capabilities:
  - db:read:  { tables: [reading_events, topics, articles] }
  - db:write: { tables: [topics, articles] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: learn

Fired by the `personalize-on-read` hook whenever a `reading_events` row is inserted. **The hook does
not pass the event id** (structured input is not delivered across the hook boundary, and it coalesces
a burst of events into one run), so **self-query** the most recent engagement and learn from the
batch.

1. Self-query the most recent engagement — the newest events, so a coalesced burst is all handled
   in one pass (`where` is **equality-only**, so sort in memory):
   ```ts
   const events = db.query('reading_events')
     .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
     .slice(0, 25);
   const signals = summarizeEngagement(events);   // per-tag net signal
   ```
2. Load the topics so you can nudge the ones the batch touched:
   ```ts
   const topics = db.query('topics');
   ```
3. For each tag the batch engaged with, nudge that topic's weight from its dominant recent signal,
   using `computeTopicWeights` so the delta stays small and clamped — never hand-roll the arithmetic.
   Update the existing topic, or insert one if this tag has never been followed before:
   ```ts
   for (const [tag, net] of Object.entries(signals.byTag)) {
     if (!tag) continue;
     const topic = topics.find(t => t.slug === tag);
     const signal = net >= 0 ? 'open' : 'dismiss';         // net-positive engagement lifts, net-negative trims
     const nextWeight = computeTopicWeights(topic?.weight ?? 1, signal);
     if (topic) {
       db.update('topics', { where: { id: topic.id }, set: { weight: nextWeight } });
     } else {
       db.insert('topics', { slug: tag, weight: nextWeight });
     }
   }
   ```

Do **not** re-score articles here — writing `topics.weight` fires the `rescore-on-topic-change`
hook, which delegates `rescore` on your behalf. Doing it again here would just duplicate the work.

## Action: rescore

Invoked with no input — from the `rescore-on-topic-change` hook (a `topics` row was updated) or
the `personalizeFeed` API.

1. Load every topic (for weights) and every article. Build the weight map in **one statement** with
   `Object.fromEntries` — variables do not persist across separate statements unless assigned, so
   never do `const m = {}` in one statement and then mutate `m[...]` in the next (it will read as
   undefined):
   ```ts
   const topics = db.query('topics');
   const topicWeights: Record<string, number> = Object.fromEntries(topics.map(t => [t.slug, t.weight ?? 1]));
   const articles = db.query('articles');
   ```
2. For each article, compute its new score from its own tags — never invent a tag it doesn't
   already carry:
   ```ts
   for (const article of articles) {
     const nextScore = scoreByTopics(article.tags ?? [], topicWeights);
     if (nextScore !== article.score) {
       db.update('articles', { where: { id: article.id }, set: { score: nextScore } });
     }
   }
   ```

This can be a large loop over every article in the feed — only write the ones whose score actually
changed (the `!==` guard above), so an unrelated topic's weight change doesn't churn the whole table
for no reason.

Guardrails:

- `where` is equality-only across all `db.*` calls — filter/sort in memory for anything beyond
  exact matches.
- Keep every weight adjustment small and bounded — `computeTopicWeights` already clamps to
  `[0.1, 5]`; don't work around that clamp.
- Never invent a topic slug or an article tag that doesn't already exist in the data — see
  `editorial/ranking-and-personalization`'s `avoiding-filter-bubbles.md` for why an unfamiliar tag
  gets a neutral default weight rather than being suppressed or fabricated a history.
