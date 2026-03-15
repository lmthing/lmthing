---
title: Layered Context
description: Organize domains from general to specific, building up context in layers
order: 3
---

# Layered Context Pattern

Organizes knowledge in concentric layers from broad context to narrow specifics. Each layer adds detail and precision.

## Structure

- **Layer 1: Environment** — Global context, platform, constraints, standards
- **Layer 2: Domain** — Subject-specific knowledge, terminology, categories
- **Layer 3: Task** — Specific to the current operation, parameters, preferences
- **Layer 4: User** — Personal context, experience level, history

## When to Use

Best for complex domains where agents need both broad knowledge and specific detail. Examples:
- DevOps spaces (environment = infrastructure, domain = service, task = operation, user = role)
- Medical spaces (environment = regulations, domain = specialty, task = procedure, user = patient)
- Legal spaces (environment = jurisdiction, domain = practice area, task = matter type, user = client)

## Implementation

```
knowledge/
├── environment/         # Layer 1: broadest context
├── domain-expertise/    # Layer 2: subject matter
├── task-config/         # Layer 3: current operation
├── user-context/        # Layer 4: personal details
```

Agents typically attach all layers but weight them differently. A coordinator agent might focus on Layer 1-2, while a specialist focuses on Layer 2-3.

## Strengths

- Mirrors how human experts think — from general principles to specific details
- Makes it clear which knowledge is reusable across tasks vs. task-specific
- Supports progressive disclosure — agents can reference deeper layers only when needed

## Considerations

- Can feel over-engineered for simple spaces with 2-3 domains
- Requires discipline to keep layers distinct — domain knowledge can bleed between layers
