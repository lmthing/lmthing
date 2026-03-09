---
title: Knowledge Area Details
description: Explore and edit knowledge files at /workspace/[workspaceId]/studio/domain/[domainId]
order: 4
---

# Knowledge Area Details (`/workspace/[workspaceId]/studio/domain/[domainId]`)

**Layout:** L3 – Two-Column Split (sidebar + tree explorer + editor)

This page lets you browse, create, and edit the markdown files that make up a knowledge area. Files here provide the context injected into agent conversations.

## Key Sections
- **Tree Explorer (C7)** — Left-center pane with hierarchical file browser, search, expand/collapse controls
- **Markdown Editor (C6)** — Right pane shows selected file content for editing
- **Empty State (C4)** — Shown in editor when no file is selected ("No file selected")

## Tree Explorer Controls
- Search input → filters files by name in real time
- "Expand" / "Collapse" buttons → open/close all folders
- "+ New File" (doc icon) → opens "New Prompt Fragment" modal
- "+ New Folder" (folder icon) → opens "New Folder" modal
- Hover file/folder → reveals three-dot context menu (Rename, Duplicate, Delete)

## Navigation Paths
- Back button in header → returns to `/workspace/{workspaceId}/studio`
- Sidebar knowledge area list → switch to another knowledge area
- Click file in tree → loads content in markdown editor

## Primary Actions
- Create file or folder (modal dialogs with location selector)
- Edit file content in monospace markdown editor
- Rename / Duplicate / Delete via context menu
- Export knowledge area via header "Export" button

## Color Scheme
- Primary: Emerald green (#ed92a1) for active tree items and buttons
- Purple dot on "Knowledge Base" label for visual differentiation
- Red text on hover for "Delete" option
