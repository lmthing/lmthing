---
title: Provisioning
description: Infrastructure being set up on Fly.io — app, volume, machine, health checks
order: 2
---

# Provisioning Status

The space is being set up on Fly.io infrastructure. The backend is allocating resources and launching the machine.

## What's Happening

During provisioning, the backend performs these steps:
1. Creates a Fly.io app with a unique name
2. Allocates a 1 GB volume in the selected region
3. Launches a machine with the space image
4. Waits for health checks to pass (HTTP GET /health every 10 seconds)
5. Updates the database status on completion

## Duration

Provisioning typically takes 30-60 seconds. The create-space API returns immediately with "provisioning" status while work happens asynchronously in the background.

## What To Do

Wait for the status to transition. Poll via list-spaces or get-space to monitor progress. If provisioning takes longer than 2 minutes, something may be wrong — check the region's availability or try a different region.

## If It Fails

The status transitions to **failed** if provisioning encounters errors. Common causes: region capacity exhaustion, image pull failures, or health check timeouts. Check logs and try reprovisioning in a different region.

## Next State

Transitions to **running** on success or **failed** on error.
