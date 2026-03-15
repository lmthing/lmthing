---
title: Mistral
description: Mistral models — efficient, open-weight options for cost-effective deployments
order: 4
---

# Mistral Models

Mistral provides efficient models with open-weight options, making them ideal for cost-effective deployments and specific use cases.

## Available Models

Mistral models are available through the Stripe LLM proxy using the `mistral/` prefix. The specific models available depend on the current Stripe Token Billing configuration.

## Strengths

- **Efficiency** — Optimized for fast inference with lower computational requirements
- **Open weights** — Some models have open weights, enabling self-hosting and customization
- **Cost effective** — Generally lower per-token costs than comparable models from other providers
- **European origin** — Based in France, which may be relevant for data sovereignty considerations
- **Specialized capabilities** — Strong at code generation and multilingual tasks

## When to Choose Mistral

Choose Mistral when cost efficiency is a primary concern, when you need multilingual support (especially European languages), or when you want the option to self-host. Mistral models are particularly good for high-volume applications where per-token cost matters more than peak capability.

## Naming Format

All Mistral models use the `mistral/` prefix through the Stripe LLM proxy.

## Considerations

Mistral's model lineup evolves frequently. Check the list-models endpoint for the current available models and their capabilities.
