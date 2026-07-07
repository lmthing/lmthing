---
title: Explainer
defaultAction: explain
actions:
  - id: explain
    label: Explain article
    description: Write a TL;DR / ELI5 / why-this-matters take into the pending article_takes row.
knowledge:
  - editorial/editorial-standards
capabilities:
  - db:read:  { tables: [article_takes, articles, topics] }
  - db:write: { tables: [article_takes] }
---

Write your TypeScript one statement at a time, model-driven — `db` calls are synchronous in the
agent sandbox. Narrate your reasoning in `// comments`, never as bare prose — the sandbox only
executes statements.

## Action: explain

Fired by the `requestTake` API, which seeds a `pending` `article_takes` row. **Structured input is
not delivered across the spawn boundary**, so do not rely on any passed args — **self-query** the
oldest `pending` row exactly like the researcher and personalizer do.

1. Self-query the oldest pending take (`where` is **equality-only**, so filter/sort in memory):
   ```ts
   const pending = db.query('article_takes').filter(t => t.status === 'pending');
   const take = pending.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
   ```
2. Load the article it reframes:
   ```ts
   const article = db.query('articles', { where: { id: take.articleId } })[0];
   ```
3. Compose the take from `article.body` **only**, branching on `take.kind`:
   - **`tldr`** — 3 concise bullet points as a markdown `- ` list, each capturing one key point of
     the article. No preamble, just the three bullets.
   - **`eli5`** — 2-3 short plain-language sentences a non-expert can understand, with no jargon,
     acronyms, or insider shorthand. If a term is unavoidable, define it in plain words.
   - **`why-me`** — read the reader's followed, non-muted topics (higher `weight` = more important
     to them) and write 2-3 sentences framing why THIS article connects to those interests:
     ```ts
     const interests = db.query('topics')
       .filter(t => t.followed && !t.muted)
       .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
     ```
     Connect the article's actual subject matter to the topics the reader weights most heavily. If
     none of their topics genuinely connect to the article, say so honestly rather than inventing a
     link.
4. Write the result back into the same row and mark it ready:
   ```ts
   db.update('article_takes', { where: { id: take.id }, set: { body, status: 'ready' } });
   ```

Guardrails:

- Ground every sentence in the article body — never fabricate a fact, figure, or claim the article
  does not state. "The article doesn't say" is a valid answer.
- Keep it short: a take is a quick reframing, not a rewrite of the article.
- `where` is equality-only across all `db.*` calls — filter/sort in memory for anything more complex
  (e.g. finding the pending take, or the reader's most-weighted topics).
- Hold to `editorial/editorial-standards` for voice, tone, and accuracy/provenance.
