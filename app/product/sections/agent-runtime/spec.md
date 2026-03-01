# Agent Runtime Specification

## Overview
A two-panel interface where users configure and run agent conversations. The left panel displays runtime fields (marked for configuration at runtime) and enabled tools with their source mappings. The right panel contains the chat interface for testing the agent. Users access this from an agent selection view.

Agents are auto-saved from Agent Builder and can be edited in place. Runtime field values enable prompt fragments from the prompt library dynamically.

## User Flows
- **Select agent** — From agent list view (`/agents`), click an agent to enter runtime view (`/agents/:id`)
- **Create conversation** — Start a new conversation thread for an agent (multiple conversations per agent supported)
- **Switch conversation** — Select from existing conversations or create a new one
- **Configure runtime fields** — Edit fields anytime; changes take effect immediately in the active conversation
- **View tools** — See all enabled tools in a collapsible section; tools are pre-installed, `installed` flag is informational
- **Run conversation** — Send messages and receive streaming token-by-token responses
- **Back to list** — Navigate back to agent list via browser back or button

## UI Requirements
- **Agent List View**: Grid/list of available agents with name, description, domain count, and last modified timestamp. Full empty state with illustration when no agents exist.
- **Runtime View Layout**: Two-panel design with runtime fields + tools (left, 35-40%) and chat interface (right, 60-65%)
- **Left Panel**:
  - Runtime fields section: form fields marked for runtime configuration, editable anytime (live updates)
  - Tools section: collapsible (default collapsed), flat list showing enabled tools with name, icon, package, version, and source field mapping
- **Right Panel**: Chat-style conversation interface with message input, streaming response display, and conversation switcher
- **Empty States**: Full empty states with illustrations and friendly messages for no agents, no conversations, and no messages
- **Shell Integration**: View renders inside the app shell with navigation header

## Configuration
- shell: true
