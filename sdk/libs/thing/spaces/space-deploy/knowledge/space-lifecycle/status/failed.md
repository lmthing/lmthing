---
title: Failed
description: Something went wrong during provisioning or runtime — requires investigation
order: 5
---

# Failed Status

Something went wrong during provisioning or runtime. The space needs investigation and likely reprovisioning.

## Common Causes

- **Region capacity** — The selected Fly.io region ran out of available machines
- **Image pull failure** — The space image couldn't be downloaded to the machine
- **Health check timeout** — The machine started but /health didn't respond within the timeout
- **Out of memory** — The machine ran out of RAM during startup
- **Configuration error** — Invalid space configuration prevented startup

## Diagnosis

1. Check the space record via get-space for any error details
2. Review Fly.io machine logs if available
3. Check if the issue is region-specific by noting which region was selected
4. Verify the space configuration is valid (slug format, required fields)

## Recovery Options

- **Different region** — Delete the failed space and create a new one in a different region
- **Retry** — Sometimes transient issues resolve themselves — try reprovisioning
- **Check configuration** — Verify the space slug is valid (lowercase alphanumeric with hyphens)
- **Stop and restart** — If the space was previously running, try stop-space then start-space

## Prevention

- Use the default region (IAD) unless you have specific requirements
- Test space configurations locally before deploying
- Monitor provisioning status and react quickly to failures
