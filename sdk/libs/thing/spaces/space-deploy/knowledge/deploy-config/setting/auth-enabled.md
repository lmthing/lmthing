---
title: Authentication
description: Enable or disable authentication for your deployed space
order: 1
---

# Authentication Setting

Control whether users must authenticate before accessing your deployed space.

## When auth_enabled = true

Users must authenticate via the lmthing SSO flow before accessing the space:
1. User visits the space URL
2. Redirected to com/ for GitHub OAuth login
3. SSO code issued and exchanged for session
4. User accesses the space with authenticated session

This is essential for:
- Spaces that handle private or user-specific data
- Spaces with per-user state or preferences
- Internal tools that should not be publicly accessible
- Spaces that need to identify who is using them

## When auth_enabled = false

The space is publicly accessible — anyone with the URL can use it. No login required.

This is appropriate for:
- Public documentation sites
- Demo spaces and showcases
- Open tools and utilities
- Spaces listed on the store for public use

## How To Set

Use the update-space endpoint with `auth_enabled: true` or `auth_enabled: false`. This can be changed at any time without redeploying the space.

## Default

New spaces default to `auth_enabled: false` (public access). Enable authentication explicitly if your space needs it.
