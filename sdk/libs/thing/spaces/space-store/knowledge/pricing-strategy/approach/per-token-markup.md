---
title: Per-Token Markup
description: Usage-based pricing via API access with a creator-set markup percentage
order: 3
---

# Per-Token Markup Pricing

Usage-based pricing where you set a markup percentage on top of base token costs. Users pay per-request through API access, and your markup generates recurring revenue automatically via Stripe.

## How Billing Works

1. User makes an API call to your deployed agent
2. The underlying LLM provider charges base token costs
3. Your markup percentage is applied on top
4. Stripe meters the total and bills the user
5. You receive your markup portion automatically

## Setting Your Markup

Choose based on the value your agent provides:

- **10–50%** — Utility agents, general-purpose tools, high-volume use cases
- **50–200%** — Specialized knowledge agents, domain expertise, moderate volume
- **200%+** — Premium niche agents with unique, hard-to-replicate capabilities

## Optimization Strategy

- Start with a moderate markup (50-100%) and monitor usage
- Track usage patterns — high volume at low markup can outperform low volume at high markup
- Consider the price sensitivity of your target audience
- Monitor churn — if users stop after a few calls, your markup may be too high
- Compare with alternatives — what would it cost users to build this themselves?

## Advantages

- Recurring revenue that scales with usage
- No upfront cost barrier for users (they pay as they go)
- Automatic billing via Stripe — no invoicing or payment collection
- Centralized updates benefit all users immediately

## Considerations

- You bear hosting costs (Fly.io space running your agent)
- Revenue depends on sustained usage — focus on agent quality and reliability
- Base model costs affect your effective margin
