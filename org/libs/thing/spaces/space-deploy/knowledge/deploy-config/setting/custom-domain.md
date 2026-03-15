---
title: Custom Domain
description: Map your own domain to a deployed space for professional branding
order: 2
---

# Custom Domain

Map a custom domain to your deployed space instead of using the default `{fly_app_name}.fly.dev` hostname.

## How It Works

1. Set the custom domain via update-space: `{ custom_domain: "myapp.example.com" }`
2. Configure DNS: add a CNAME record pointing your domain to the Fly.io app hostname
3. Fly.io automatically provisions and manages TLS certificates
4. Users access your space at your custom domain with full HTTPS

## Requirements

- You must own and control the domain's DNS
- The domain must be unique across all lmthing spaces
- Only one custom domain per space
- The CNAME must point to your space's Fly.io hostname

## Benefits

- Professional branding — your space looks like your own product
- Memorable URLs — easier for users to remember and share
- Trust — custom domains convey legitimacy and permanence
- SEO — if your space serves public content, a custom domain helps

## DNS Configuration

Add a CNAME record in your domain's DNS settings:
```
myapp.example.com.  CNAME  {fly_app_name}.fly.dev.
```

TLS certificates are provisioned automatically by Fly.io — no manual certificate management needed. Certificate renewal is also automatic.

## Removing

Set `custom_domain` to null via update-space to revert to the default Fly.io hostname.
