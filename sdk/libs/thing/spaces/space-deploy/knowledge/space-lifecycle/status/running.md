---
title: Running
description: Space is live and accessible — health checks passing, publicly reachable
order: 3
---

# Running Status

The space is live and accessible. The Fly.io machine is running, health checks are passing, and the space is reachable at its public URL.

## What It Means

- The machine is active and consuming compute resources (billing accrues)
- Health checks pass every 10 seconds via HTTP GET /health
- The space is accessible at `{fly_app_name}.fly.dev`
- If auth is disabled, anyone can access the space
- Running spaces are visible to the public via get-space (RLS allows public SELECT)

## Access

Users connect via WebSocket using short-lived HMAC tokens from issue-space-token (5-minute TTL). The token authenticates the connection and identifies the user.

## Cost Implications

Running spaces accrue compute costs continuously. Stop spaces you're not actively using to save money. You can restart them anytime without losing data.

## What To Do

Monitor health checks and resource usage. Watch for degraded performance or failing health checks. Use the /status flow to review all running spaces periodically.

## Next States

- **stopped** — via stop-space (preserves data, stops billing)
- **destroyed** — via delete-space (permanent, destroys all resources)
