# Tool Library Specification

## Overview
A three-pane interface for managing function-calling tools — browsing available tools, managing npm packages, and configuring workspace-level environment variables. Users discover built-in and installed tools, install new packages from npm, and set the credentials tools need to function.

## User Flows
- **Browse tools** — View all available tools (built-in + installed) with search and filter, click a tool to see details including parameters, documentation, and which prompt fragments reference it
- **Install packages** — Search npm registry for packages, preview what tools a package provides, install by name, view installed packages with versions and update options
- **Configure environment** — Add/edit/delete workspace environment variables as key-value pairs for API keys, endpoints, and other configuration
- **Navigate sections** — Use sidebar to switch between Tools, Packages, and Environment views

## UI Requirements
- Sidebar navigation with three sections: Tools, Packages, Environment
- **Tools view**: Grid or list of tool cards with name, description, source (built-in/package), and status indicators; detail panel showing parameters, usage references, and documentation
- **Packages view**: Search bar for npm registry, installed packages list with version/author/status, install-by-name input, package preview modal showing included tools
- **Environment view**: Key-value editor with add/delete actions, variable names and values, support for secrets masking
- Search and filter capabilities across tools and packages
- Visual indicators for built-in vs package tools, install status, and update availability

## Configuration
- shell: true
