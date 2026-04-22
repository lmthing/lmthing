---
title: Volumes
description: Persistent storage that survives machine restarts
order: 2
---

# Fly.io Volumes

Fly.io Volumes provide persistent storage for your computer node. Each computer gets a 1 GB volume attached at provisioning time that persists data across machine restarts.

## Persistence

Volumes survive start/stop cycles — your files, configurations, installed packages, and workspace state are preserved when the machine is stopped and restored when it starts again. This is the key difference from ephemeral machine storage.

## What's Stored

- Workspace files synced from your GitHub repository
- Installed packages and dependencies
- Runtime state and configuration
- Logs and temporary files
- Any files you create via terminal

## Region Locking

Volumes are region-locked — they must be in the same Fly.io region as the machine. If you need to change regions, you'll need to destroy the current computer and provision a new one in the desired region. Volume data does not transfer between regions.

## Lifecycle

- **Created** during provisioning alongside the machine
- **Attached** to the machine at startup
- **Persists** through stop/start cycles
- **Destroyed** when the computer is deleted (via delete or subscription cancellation)

## Size Limit

Each volume is 1 GB. Monitor disk usage via terminal commands (`df -h`) to avoid running out of space. If the volume fills up, the machine may behave unpredictably — clear unnecessary files or rebuild the computer.

## Important

Volume destruction is permanent. When you destroy your computer (or cancel your Computer tier subscription), the volume and all its data are deleted. Push workspace changes to GitHub before destroying to preserve your work.
