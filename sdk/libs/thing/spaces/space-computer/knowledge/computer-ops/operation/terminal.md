---
title: Terminal
description: Access your computer's full shell via WebSocket terminal
order: 3
---

# Terminal Access

Access your computer's terminal via a WebSocket connection, giving you a full shell session on your Fly.io machine.

## How It Works

The terminal provides a full PTY (pseudo-terminal) session with shell access. The computer dashboard uses xterm.js as the frontend terminal emulator, which connects to your machine via WebSocket.

## Authentication

Terminal access requires a short-lived HMAC token:
1. Call `issue-computer-token` to get a 5-minute access token
2. The token is used to authenticate the WebSocket connection
3. Tokens expire after 5 minutes — the dashboard handles refresh automatically
4. Token verification uses the machine's `TOKEN_SECRET` environment variable

## What You Can Do

The terminal gives you full access to the Linux environment:
- Run any shell command
- Install packages via apt or npm
- Edit files with vim, nano, or other editors
- Manage processes (start, stop, monitor)
- Access the network (curl, wget, ssh)
- Run Node.js scripts and development tools

## Pre-Installed Tools

The computer image comes with:
- Linux base environment
- Node.js runtime
- Common development tools
- npm/pnpm package managers

## Tips

- Use `tmux` or `screen` for persistent terminal sessions that survive disconnections
- Monitor resource usage with `top` or `htop` to avoid exhausting the 1 GB RAM limit
- Your workspace files are available on the mounted volume
- Push changes to GitHub before disconnecting to preserve your work
