---
title: Studio Dashboard
description: The main workspace hub at /workspace/[workspaceId]/studio
order: 2
---

# Studio Dashboard (`/workspace/[workspaceId]/studio`)

**Layout:** L2 – Three-Column Dashboard (sidebar + main, no right panel)

The studio dashboard is the control center for a workspace. It shows knowledge areas and agents in a grid and provides all workspace management actions.

## Key Sections
- **Sidebar (C2)** — Lists KNOWLEDGE areas, AGENTS, CONVERSATIONS with count badges
- **Main Content** — Two grids: Knowledge Areas (emerald green) and Agents (violet)
- **Header (C1)** — Workspace selector dropdown, Thing button, Export button

## Navigation Paths
- Click knowledge area card → `/workspace/{id}/studio/domain/{domainId}`
- Click agent card → `/workspace/{id}/studio/agent/{agentId}`
- Click workspace selector → opens workspace switcher modal
- Click Settings in sidebar → opens tabbed settings modal

## Primary Actions
- "+ Create Knowledge" → simple form modal (name + description)
- "+ Create Agent" → simple form modal (name + description)
- "Thing" button → slides in C10 panel for workspace automation
- "Export" → downloads workspace bundle

## Color Scheme
- Knowledge: Emerald green (#10b981)
- Agents: Violet purple (#7c3aed)
- Card hover: intensified border color + medium shadow
