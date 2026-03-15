---
title: App Config
description: Flexible JSONB configuration store for space-specific settings
order: 3
---

# App Config

A flexible JSONB configuration store for any space-specific settings that don't fit into the standard fields.

## What It Is

The `app_config` field on each space record is a JSONB column that stores arbitrary key-value configuration. Your space's runtime code can read this configuration to customize behavior without modifying the deployment.

## Common Uses

- **Feature flags** — Enable or disable features for specific spaces
- **Default agent** — Which agent should handle initial interactions
- **Theme configuration** — Colors, branding, layout preferences
- **API endpoint overrides** — Custom service URLs for integrations
- **Per-space environment** — Configuration values specific to this deployment
- **Rate limits** — Custom rate limiting for API-access spaces

## How To Set

Use the update-space endpoint with the `app_config` object:
```json
{
  "id": "space-uuid",
  "app_config": {
    "defaultAgent": "agent-helper",
    "theme": "dark",
    "features": { "chat": true, "analytics": false }
  }
}
```

## Important

The entire `app_config` is **replaced** on update, not merged. Always send the complete configuration — if you only send one key, all other keys are lost. Read the current config first, modify it, then send the full updated version.

## Reading Config

The space's runtime code accesses `app_config` from the space record. This is available at startup and can be refreshed by re-reading the space record from the database.
