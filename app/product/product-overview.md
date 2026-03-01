# LMThing

## Description
A multi-user, schema-driven platform that enables domain experts to collaboratively author, visually configure, and deploy highly specialized AI agents without writing code.

## Problems & Solutions

### Problem 1: Prompt engineering is hard
Domain experts struggle to craft effective system prompts and agent behaviors. LMThing provides a modular, file-based approach where experts author isolated fragments (tone, constraints, knowledge) that are automatically assembled into optimized system prompts.

### Problem 2: No-code agent creation
Building agents typically requires writing code and managing infrastructure. LMThing generates dynamic, type-safe forms from directory structures — experts simply fill out forms to instantiate specialized agents.

### Problem 3: Enterprise AI governance
Enterprises need governance, version control, and collaboration for AI systems. LMThing supports isolated workspaces for individual experts and shared environments for cross-functional collaboration, with version-controlled prompt fragments.

### Problem 4: Domain specialization
General LLMs lack domain-specific knowledge and constraints. LMThing enables experts to encode their domain expertise as structured, reusable prompt fragments that create perfectly tailored, token-efficient system prompts.

### Problem 5: Agent tooling integration
AI agents need external capabilities — APIs, databases, utilities — to be useful. LMThing provides a Tool Library where function-calling tools (built-in or npm-installable) are cataloged, configured, and automatically attached to agents based on prompt fragment selection.

## Key Features
- Modular prompt authoring via filesystem-based fragments (.md files)
- Automatic schema generation from directory structures
- Dynamic form rendering for agent configuration
- JSON-based agent payload generation and validation
- Multi-user workspaces with collaboration support
- Version-controlled prompt fragments and taxonomies
- Tool Library with function-calling capabilities (built-in + npm packages)
- Automatic tool attachment based on prompt fragment metadata and directory config
- Workspace-level environment variables for secure tool configuration
