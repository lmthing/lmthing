---
title: Overlay Components
description: Modal dialogs, floating buttons, and sliding panels for contextual actions
order: 3
---

# Overlay Components

## C8: Modal Dialog
Centered overlay with backdrop, used throughout the app for creation and selection tasks.

**Variants:**
- **Simple form modal** — name + description inputs with Create/Cancel
- **Complex tabbed modal** — e.g., Workspace Settings (package.json / Env Files / Providers tabs)
- **Selection modal** — searchable list of items (workspaces, flows) to choose from

**Always includes:** Title, close button, footer with action buttons.

## C9: Floating Action Button
Fixed position button (bottom-right) on the Agent Configuration page.

**Used for:** Opening the Runtime Conversation Preview (sandbox chat).
**Styling:** Large, violet background, icon + "Chat" label.
**Behavior:** Clicking opens a chat overlay; conversations use the current agent configuration.

## C10: Sliding Side Panel
Right-side panel that slides in from the edge when "Thing" button is clicked.

**Contains:**
- "Workspace actions" section
- "New chat" button
- Conversation history list
- Command input field (supports `help`, `status`, JSON action envelopes)

**Behavior:** Clicking "Thing" again or the backdrop closes the panel.
**Coexistence:** May replace or overlay the right action panel on the Agent Configuration page.
