---
title: File Management
description: How the virtual file system works and how to manage workspace files
order: 1
---

# File Management

The lmthing workspace uses an in-memory virtual file system (VFS) backed by a `Map<string, string>`. All workspace files — agents, flows, knowledge — live in this VFS during your session.

## How the VFS Works

Files are stored as key-value pairs where the key is the file path and the value is the file content (always strings). The FSEventBus provides fine-grained subscriptions so UI components update automatically when files change.

## React Hooks

- **useFile(path)** — Read and write a single file. Returns content and a setter.
- **useDir(path)** — List files in a directory. Returns an array of file paths.
- **useGlob(pattern)** — Match files by glob pattern. Useful for finding all agents or all flows.
- **useDraft(path)** — Create an unsaved draft of a file for preview before committing.

## File Operations

- **Create** — Write a new file to the VFS. The directory structure is implicit (no mkdir needed).
- **Read** — Access file content by path. Returns undefined if the file doesn't exist.
- **Update** — Overwrite existing file content. The FSEventBus notifies all subscribers.
- **Delete** — Remove a file from the VFS. Subscribers are notified of the deletion.

## Workspace Organization

Files follow the space structure: `{space-slug}/agents/`, `{space-slug}/flows/`, `{space-slug}/knowledge/`. The raw file editor in Studio gives you direct access to read and edit any file in the workspace.
