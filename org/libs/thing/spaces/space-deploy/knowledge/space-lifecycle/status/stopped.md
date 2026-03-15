---
title: Stopped
description: Machine stopped, volume preserved, no running costs — can restart anytime
order: 4
---

# Stopped Status

The space's Fly.io machine has been stopped. The volume data is preserved, but no compute costs accrue.

## What It Means

- The machine is not running — no CPU, no health checks, no accessibility
- The 1 GB volume and all its data are preserved
- No compute billing in this state
- The space can be restarted anytime via start-space

## When To Stop

Stop spaces that don't need to be always-on:
- Development and testing spaces between work sessions
- Demo spaces after presentations
- Seasonal or infrequently used tools
- Any space where cost optimization matters

## Restarting

Call start-space with the space's ID to restart. The machine boots with the same volume attached — all files, configurations, and data are preserved. Starting typically takes a few seconds including health check verification.

## What To Do

If you have many stopped spaces, consider whether some should be destroyed instead. Stopped spaces still consume volume storage (though not compute). Delete spaces you no longer need to clean up completely.

## Next States

- **running** — via start-space (boots machine, attaches volume)
- **destroyed** — via delete-space (permanent cleanup)
