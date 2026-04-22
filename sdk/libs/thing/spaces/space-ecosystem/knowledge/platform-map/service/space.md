---
title: Space
description: Deploy spaces to containers and publish agents for API access
order: 4
---

# lmthing.space

The deployment platform for lmthing spaces. Deploy your agents and workflows to isolated Fly.io containers, making them accessible via the web or API.

## What It Does

Space takes what you've built in Studio and deploys it to production infrastructure. Each deployed space gets its own Fly.io machine, persistent volume, and public URL. You can configure authentication, custom domains, and application settings.

## Key Features

- **Container deployment** — Each space runs in its own isolated Fly.io machine
- **Lifecycle management** — Create, start, stop, and delete deployments
- **Access controls** — Enable/disable authentication for public or private spaces
- **Custom domains** — Map your own domain with automatic TLS
- **Health monitoring** — HTTP health checks every 10 seconds
- **Region selection** — Deploy to US East, US West, London, or Amsterdam

## When to Use

Use Space when you want to make an agent or workflow accessible to others — whether as a web app, an API endpoint, or a published service. Deploy spaces for production use, demos, or to power API-access listings on the Store.

## How It Connects

Spaces are built in Studio, deployed via Space, and can be listed on the Store for distribution. Each space interacts with the cloud backend for provisioning and token management. Deployed spaces are accessible at {fly_app_name}.fly.dev.
