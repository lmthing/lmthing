---
title: Content Components
description: Editor, card grid, and empty state components for displaying and editing content
order: 2
---

# Content Components

## C3: Card Grid
Responsive grid (typically 2-3 columns) used to display Knowledge Areas and Agents.

**Card structure:**
- Icon/Avatar (top-left)
- Title and subtitle
- Description text
- Metadata badges
- Action button (bottom or overlay)

**Hover state:** Shadow deepens, border color intensifies using semantic color (Emerald for Knowledge, Violet for Agents).

## C4: Empty State
Shown when a section has no content or no file is selected.

**Contains:**
- Large centered icon
- Bold heading (e.g., "No file selected")
- Descriptive subtitle with guidance
- Optional CTA button

## C5: Pill/Tag Selection Bar
Horizontal scrollable bar of interactive pills on the Agent Configuration page.

**Used for:** Attaching/detaching knowledge domains to an agent.
**States:** Active (violet with checkmark) / Inactive (gray).
**Controls:** Click to toggle, "Clear all" button to detach all.

## C6: Markdown Editor
Large textarea with monospace font for editing `.md` files.

**Features:**
- Syntax highlighting support
- Full markdown editing capability
- Auto-save or explicit save
- Used in both Knowledge Area Details and Agent Instructions
