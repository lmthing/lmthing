---
title: GitHub Sync
description: How workspace persistence works via GitHub repositories
order: 2
---

# GitHub Sync

All workspace data persists through a private GitHub repository created during onboarding. The VFS is ephemeral (in-memory) — GitHub is the source of truth.

## How It Works

During onboarding (first login via com/), a private GitHub repo is created to store your workspace. The repo name is saved in your profile (`github_repo` field). All workspace files — agents, flows, knowledge, package.json — live in this repo.

## Push and Pull

- **Pull** — Downloads the latest files from your GitHub repo into the in-memory VFS. Do this when starting a new session or when you want to sync changes made elsewhere.
- **Push** — Uploads your current VFS state to the GitHub repo. Do this to save your work. Changes are committed and pushed to the default branch.

## Conflict Resolution

If both the VFS and GitHub have changes to the same file, standard git merge workflows apply. The system attempts automatic merges for non-conflicting changes. For conflicts, you'll need to resolve them manually — choose which version to keep or merge the changes.

## Best Practices

- Push frequently to avoid losing work (the VFS is ephemeral)
- Pull before starting work to ensure you have the latest version
- Use meaningful workspace organization — it maps directly to your git history
- Your GitHub token (from OAuth login with `repo` scope) provides the access needed for sync
