---
title: Provision
description: How to provision your personal computer node on Fly.io
order: 1
---

# Provisioning

Provisioning creates your personal computer node on Fly.io. It's a one-time setup process that allocates all the infrastructure your computer needs.

## Prerequisites

You need an active Computer tier Stripe subscription before provisioning. The system enforces one computer per user via a unique `user_id` constraint in the database.

## The Process

1. Call the `provision-computer` edge function with an optional `region` parameter (defaults to "iad")
2. The backend creates a Fly.io app with a unique name
3. A 1 GB volume is allocated in the selected region
4. A machine is launched with the computer image and your environment variables injected
5. Health checks verify the machine is responsive
6. Status updates from "provisioning" to "running"

## Async Operation

Provisioning is asynchronous — the API returns immediately with status "provisioning" while the machine spins up in the background. The actual provisioning typically takes 30-60 seconds. The backend automatically updates the database status when provisioning completes or fails.

## What Gets Created

- A Fly.io app (container namespace)
- A 1 GB persistent volume
- A machine with: 1 shared CPU, 1 GB RAM, computer image, environment variables

## After Provisioning

Once status transitions to "running," you can:
- Get an access token via `issue-computer-token`
- Connect to the terminal through the computer dashboard
- Start using your computer for agent execution and development

## If Provisioning Fails

Check the status — if it shows "failed," the most common causes are region capacity issues or image pull failures. Try provisioning again in a different region.
