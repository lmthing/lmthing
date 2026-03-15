---
title: API Access
description: Offer API access to your agent with per-token billing and a creator-set markup
order: 3
---

# API Access Distribution

Offer API access to your agent running on a deployed space. Users don't get the source code — they call your agent via API and pay per-token with a markup you set on top of base model costs.

## When to Use

- Agents with proprietary knowledge you don't want to share
- Agents that require specific infrastructure or runtime configuration
- When you want recurring revenue rather than one-time sales
- Agents that benefit from centralized updates — fix once, all users benefit
- Complex agents where setup would be burdensome for end users

## How It Works

1. Deploy your agent to a space using space-deploy (Fly.io container)
2. List the agent on the store with API access distribution
3. Set your per-token markup percentage
4. Users call your agent's API endpoint — Stripe handles metering and billing
5. You receive your markup on every request automatically

## Revenue Model

Revenue comes from the per-token markup on top of base model costs. The Stripe billing system handles all metering and payments automatically. You set the markup percentage, and every API call generates revenue.

## Pricing Your Markup

- **10–50%** — Utility agents, general-purpose tools
- **50–200%** — Specialized knowledge agents, domain expertise
- **200%+** — Premium, niche agents with unique capabilities

## Considerations

- You maintain the deployment (hosting costs via your Fly.io space)
- Centralized updates mean all users get improvements immediately
- Monitor usage patterns to optimize pricing over time
- Higher markups work when your agent provides truly unique value
