---
title: Fly Machines
description: Lightweight VMs that run your personal lmthing computer node
order: 1
---

# Fly.io Machines

Fly.io Machines are lightweight VMs that run your lmthing computer node. Each computer gets a dedicated machine with 1 shared CPU and 1 GB RAM (shared-cpu-1x specification).

## How They Work

Machines can be started and stopped on demand — you only pay when running. The machine runs the lmthing computer image with WebSocket support for terminal access, PTY for shell sessions, and metrics collection for monitoring.

## Provisioning

Machines are provisioned via the Fly.io Machines API (REST), managed through the provision-computer cloud edge function. The provisioning process:

1. Create a Fly.io app with a unique name
2. Allocate a 1 GB volume in the selected region
3. Launch a machine with the computer image
4. Wait for health checks to pass
5. Update status from "provisioning" to "running"

## Environment Variables

Each machine gets these environment variables injected at startup:
- `USER_ID` — Your lmthing user ID
- `RUNTIME_MODE` — Set to "computer"
- `TOKEN_SECRET` — Secret for HMAC token verification

## Machine States

Machines transition through these states: **created** → **provisioning** → **running** → **stopped** → **destroyed**. You control transitions via start-space/stop-space endpoints or the computer dashboard.

## Specifications

- **CPU:** 1 shared vCPU
- **RAM:** 1 GB
- **Image:** lmthing computer image (Linux, Node.js pre-installed)
- **Ports:** HTTP on 8080 with auto-TLS upgrade
