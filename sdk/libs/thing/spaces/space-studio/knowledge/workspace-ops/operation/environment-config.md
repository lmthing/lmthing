---
title: Environment Configuration
description: Managing environment variables, API keys, and provider settings
order: 3
---

# Environment Configuration

Configure your workspace environment — API keys for external services, provider endpoints, and runtime settings.

## Environment Variables

Environment variables control how your agents connect to external services. In Studio, you can manage them through the settings panel. Variables are stored securely and are available to agents during conversations.

## API Keys

lmthing uses `lmt_` prefixed API keys for programmatic access. These are managed through the cloud backend:

- **create-api-key** — Generate a new key (returned once, stored as SHA-256 hash)
- **list-api-keys** — View active keys (prefix only, never the full key)
- **revoke-api-key** — Soft-delete a compromised key

For external services (OpenAI, custom endpoints), configure provider-specific API keys in your environment settings.

## Provider Configuration

The default LLM provider routes through Stripe's proxy at llm.stripe.com. For local development or custom setups:

- **Stripe** (default) — Production routing with automatic token metering
- **Ollama** — Local/offline LLM access for development
- **OpenAI** — Direct API access without Stripe metering

Provider selection is controlled by the `LLM_PROVIDER` environment variable on the backend.

## Secrets Management

Never commit API keys or secrets to your workspace files. Use environment variables for sensitive values. The VFS syncs to GitHub — anything in files is visible in your repo.
