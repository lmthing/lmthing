---
title: Computer
description: Personal Fly.io runtime node with terminal access and IDE
order: 3
---

# lmthing.computer

Your personal runtime environment — a dedicated Fly.io machine where THING runs with full terminal access, file management, and IDE capabilities.

## What It Does

Computer gives you a persistent, cloud-based development environment. It provides terminal access to a Fly.io node (1 shared CPU, 1 GB RAM) where you can run agents, manage files, install packages, and monitor processes. Think of it as your personal cloud computer dedicated to running THING.

## Key Features

- **Terminal access** — Full PTY session via WebSocket with xterm.js frontend
- **IDE capabilities** — File tree, editor, and preview panel
- **Process management** — Run and monitor background processes
- **Resource monitoring** — CPU, memory metrics, and health checks
- **Persistent storage** — 1 GB volume survives machine restarts
- **Start/stop on demand** — Only pay when the machine is running

## When to Use

Use Computer when you need a persistent runtime for THING — running agents autonomously, executing longer tasks, or having a dedicated development environment in the cloud. Required for agents that need file system access, package installation, or long-running processes.

## Requirements

Computer requires an active Computer tier subscription. The machine is provisioned via the provision-computer edge function and accessed through short-lived HMAC tokens.

## How It Connects

Computer runs agents built in Studio, using the same knowledge and flows. It syncs workspace data from your GitHub repo. Access tokens are issued through the cloud backend.
