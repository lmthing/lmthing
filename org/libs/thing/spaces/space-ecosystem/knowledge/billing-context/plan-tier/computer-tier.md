---
title: Computer Tier
description: Everything in Pro plus a dedicated K8s compute pod
order: 4
---

# Computer Tier

The Computer tier includes everything in Pro plus a dedicated K8s pod — your personal cloud computer for running THING with full terminal access.

## What's Included

- **Everything in Pro** — Full model catalog, higher token limits, all features
- **Dedicated K8s pod** — 1 shared CPU, 1 GB RAM, persistent 1 GB volume
- **Terminal access** — Full shell via WebSocket with xterm.js
- **IDE capabilities** — File tree, editor, preview panel in the Computer dashboard
- **Start/stop control** — Only pay when the machine is running
- **Region selection** — Deploy in US East, US West, London, or Amsterdam

## How It Works

When you subscribe to the Computer tier, a K8s pod is automatically provisioned for you. The pod runs a Linux environment with Node.js and development tools pre-installed. Access is controlled via short-lived HMAC tokens (5-minute TTL) issued by the cloud backend.

Your machine persists data on a 1 GB volume that survives restarts. Workspace files sync from GitHub, and any changes you make on the machine can be pushed back.

## Who It's For

Computer is for power users who need autonomous agent execution, long-running tasks, or a persistent development environment in the cloud. It's essential for agents that need file system access, package installation, or runtime capabilities beyond the browser.

## Subscription Management

Computer tier is managed through Stripe. If you cancel, your pod is automatically destroyed (data included). Re-subscribing provisions a fresh pod.
