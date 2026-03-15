---
title: Created
description: Initial state — space exists as metadata but no infrastructure provisioned yet
order: 1
---

# Created Status

The initial state when a space record is created in the database. The space exists as metadata (name, slug, description) but no Fly.io resources have been provisioned yet.

## What It Means

A "created" space is just a database record. No Fly.io app, volume, or machine exists. This is a transient state — spaces typically move to "provisioning" almost immediately as the backend begins allocating infrastructure.

## When You See This

- Briefly during the create-space API call before provisioning begins
- If the provisioning request failed before reaching Fly.io
- If there was a network error between the backend and Fly.io API

## What To Do

If a space stays in "created" state for more than a few seconds, something went wrong with the provisioning trigger. Try calling create-space again or check the backend logs for errors. The space record may need to be cleaned up before reprovisioning.

## Next State

Normally transitions to **provisioning** immediately after creation.
