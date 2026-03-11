---
title: Navigation Components
description: Header, sidebar, and tree explorer components used for app navigation
order: 1
---

# Navigation Components

## C1: Application Header
The top bar that appears on every page.

**Contains:**
- **Left:** Logo + workspace selector dropdown + quick add button
- **Center:** Page title and subtitle (contextual to current page)
- **Right:** "Thing" button, "Export" button, "Login with GitHub" button

**Behavior:**
- Workspace selector opens a searchable modal with workspace list
- "Thing" button toggles the sliding right panel (C10), text changes to "Hide Thing"
- "Export" button downloads the current workspace or entity configuration

## C2: Sidebar Navigation
Fixed-width left panel present on Studio and detail pages.

**Sections:**
- KNOWLEDGE (with count badge) → list of knowledge areas + "+ Create Knowledge"
- AGENTS (with count badge) → list of agents + "+ Create Agent"
- CONVERSATIONS (with count badge) → context-dependent list
- Settings link (bottom)
- Collapse toggle (bottom)

**Active state:** Highlighted with Emerald (Knowledge) or Violet (Agents) accent color.

## C7: Tree Explorer
Hierarchical file browser used on the Knowledge Area Details page.

**Controls:**
- Search input (top) — real-time filter
- "Expand" / "Collapse" buttons — open or close all folders
- "+ New File" button — opens file creation modal
- "+ New Folder" button — opens folder creation modal
- Hover → reveals three-dot context menu per item
