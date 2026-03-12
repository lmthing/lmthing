# lmthing.blog

Personalized AI-generated news. A THING agent continuously fetches, synthesizes, and presents news tailored to each user.

## Overview

Users subscribe to RSS feeds and web search queries. A THING agent running on a shared serverless worker (not the user's Space) fetches, synthesizes, and presents news. Users can ask for deeper research on any topic and publish stories to their public profile.

## Routing

```mermaid
graph TD
    Root["/"] --> Feed["/feed<br/>Personalized news stream"]
    Root --> Preferences["/preferences<br/>RSS feeds · Web searches · Topics"]
    Root --> Profile["/$username<br/>Public profile & stories"]
    Feed --> Article["/$articleId<br/>Synthesized article"]
    Article --> Research["/research<br/>Deep dive on topic"]
    Profile --> Publish["/publish<br/>Write & publish stories"]
```

## Revenue Model

- **Free tier** — $1/week allowance, limited RSS feed subscriptions, uses a cheap model.
- **Blog subscription** — $5/month for unlimited RSS + web search subscriptions, deep research on demand, and publishing.
