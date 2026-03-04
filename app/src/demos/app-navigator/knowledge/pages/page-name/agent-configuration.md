---
title: Agent Configuration
description: Configure a specific AI agent at /workspace/[workspaceId]/studio/agent/[agentId]
order: 3
---

# Agent Configuration (`/workspace/[workspaceId]/studio/agent/[agentId]`)

**Layout:** L2 – Three-Column Dashboard (full: sidebar + center + right panel)

This page is where you configure a single agent's identity, knowledge attachments, instructions, and capabilities.

## Key Sections
- **Knowledge Pills Bar (C5)** — Horizontal scrollable pills to attach/detach knowledge domains (violet when active)
- **Main Instructions (C6)** — Large monospace markdown textarea for the agent's system prompt
- **Area Knowledge section** — Accordion cards showing attached knowledge domain content
- **Right Panel** — Tabbed view: "Actions" (attached flows) and "Tools" tabs
- **Chat FAB (C9)** — Fixed bottom-right violet button to open Runtime Conversation Preview

## Navigation Paths
- Back button in header → returns to `/workspace/{workspaceId}/studio`
- Sidebar agent list → switch to another agent
- "Attach Flow" button → opens flow selection modal

## Primary Actions
- Toggle knowledge pills → attach or detach knowledge domains
- Edit main instructions textarea → define agent system prompt
- Attach Flow → links slash commands to multi-step flows
- Hover action card → edit / disable / detach flow
- Click Chat FAB → opens sandbox chat overlay

## Color Scheme
- Primary: Violet purple (#7c3aed) for all agent-related elements
- Active knowledge pills: Violet with checkmark
- Action status "Active" badge: Emerald green
