---
title: Networking
description: How computer nodes are accessed — hostnames, TLS, WebSocket, and token auth
order: 3
---

# Networking

Computer nodes are accessible via Fly.io's global anycast network with automatic TLS, WebSocket support, and token-based authentication.

## Public Hostname

Each machine gets a public hostname: `{fly_app_name}.fly.dev`. This hostname routes to your machine from anywhere in the world via Fly.io's anycast network.

## HTTP and TLS

HTTP traffic on port 8080 is routed to the machine with automatic TLS termination. All connections are encrypted — no manual certificate management needed. The service configuration includes automatic HTTP-to-HTTPS upgrade.

## WebSocket Support

Terminal access uses WebSocket connections upgraded from HTTP. The xterm.js frontend in the computer dashboard establishes a WebSocket connection to your machine's PTY session. WebSocket connections are long-lived and support bidirectional data flow for real-time terminal interaction.

## Health Checks

Health checks run every 10 seconds via HTTP GET to `/health` with a 5-second timeout. If health checks fail repeatedly, the machine may be in a degraded state. The health check endpoint verifies the machine's core services are responsive.

## Token Authentication

Access is controlled via short-lived HMAC tokens issued by the `issue-computer-token` cloud edge function. Tokens have a 5-minute TTL and must be presented when establishing WebSocket connections. The token contains:
- User identity
- Expiration timestamp
- HMAC signature (verified by the machine using TOKEN_SECRET)

## Security

- All traffic is encrypted via TLS
- Tokens expire after 5 minutes, limiting exposure from leaked tokens
- HMAC signatures prevent token forgery
- Only the authenticated user can access their machine
