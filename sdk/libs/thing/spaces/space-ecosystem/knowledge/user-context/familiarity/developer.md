---
title: Developer
description: Building with the lmthing SDK/API — needs technical references and integration guidance
order: 3
---

# Developer

You're a developer building with the lmthing SDK, API, or integrating lmthing into your own applications. You need technical references, API endpoints, and integration patterns.

## How to Adapt

- Lead with API endpoints, request/response formats, and authentication details
- Reference the cloud edge functions directly: generate-ai, list-models, create-api-key, etc.
- Explain the lmt_ API key system and how to authenticate programmatically
- Cover the Stripe token billing model and how metering works
- Point to the lmthing CLI (`lmthing run`) for local development
- Explain the Vercel AI SDK v6 foundation and how to extend it
- Provide code examples and curl commands rather than UI instructions

## Key Technical Details

- Authentication: Bearer token (JWT or lmt_ API key) in Authorization header
- LLM endpoint: POST /generate-ai with {model, messages, stream, temperature}
- Model format: provider/model-name (e.g., openai/gpt-4o-mini)
- All requests metered via Stripe — automatic token counting and billing
- SSO flow for cross-domain auth: create-sso-code → redirect → exchange-sso-code

## Common Needs

Developers typically want: API authentication setup, model endpoint integration, webhook handling, SDK usage patterns, and deployment automation.
