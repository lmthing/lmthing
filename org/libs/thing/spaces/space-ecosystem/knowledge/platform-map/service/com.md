---
title: Com
description: Central auth hub, account management, and commercial landing page
order: 10
---

# lmthing.com

The central authentication hub and commercial landing page for the lmthing platform. All cross-domain authentication flows through com/.

## What It Does

Com serves two purposes: it's the public-facing landing page for lmthing (pricing, features, documentation), and it's the central authentication hub that all other services redirect to for login.

## Key Features

- **GitHub OAuth login** — Single sign-on via GitHub (the only auth provider)
- **User onboarding** — Creates a private GitHub repo during first login to store workspace data
- **SSO hub** — Issues single-use SSO codes for cross-domain authentication
- **Account management** — Profile settings, display name, connected GitHub account
- **Billing portal** — Manage subscriptions, payment methods, and view usage
- **API key management** — Create, list, and revoke lmt_ API keys for SDK/CLI access

## When to Use

You interact with com/ primarily during login and account management. It's the entry point for new users and the management console for existing ones. Most users don't visit com/ regularly — it works behind the scenes to authenticate you across all services.

## How It Connects

Every lmthing service redirects to com/ for authentication. Com issues SSO codes that services exchange for sessions. It manages the Supabase Auth integration and Stripe billing portal. The onboarding flow creates the GitHub repo that all workspace sync depends on.
