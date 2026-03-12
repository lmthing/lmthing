---
title: Flow index.md
description: The entry point for a flow — title, description, and step links
order: 7
---

# Flow `index.md` — Entry Point File

Located at `flows/flow_{id}/index.md`. This is the first file the platform reads for a flow.

## Full Schema

```markdown
# {Flow Display Title}

{One or two sentences describing what this flow accomplishes — written from the user's perspective.}

1. [{Step 1 Name}](1.{Step%20Name}.md)
2. [{Step 2 Name}](2.{Step%20Name}.md)
3. [{Step 3 Name}](3.{Step%20Name}.md)
4. [{Step 4 Name}](4.{Step%20Name}.md)
5. [{Step 5 Name}](5.{Step%20Name}.md)
```

## Rules

| Element | Rules |
|---|---|
| `# Title` | H1 heading, Title Case, descriptive action phrase |
| Description | 1-2 sentences. What does the flow accomplish? Who benefits? |
| Step links | Numbered ordered list (`1.`, `2.`...) |
| Link text | Human-readable step name (can have spaces) |
| Link target | URL-encoded filename: spaces → `%20`, must include number prefix |

## URL Encoding Reference

| Original Filename | URL in index.md Link |
|---|---|
| `1.Gather Context.md` | `1.Gather%20Context.md` |
| `3.Write the Draft.md` | `3.Write%20the%20Draft.md` |
| `5.Review and Finalize.md` | `5.Review%20and%20Finalize.md` |

## Validation

- ✅ `# Title` is present (H1 only)
- ✅ Description paragraph is present
- ✅ List is ordered (`1.`, `2.`) not unordered (`-`)
- ✅ Step count = number of step files in the folder
- ✅ Each link target matches an actual file (with correct number prefix)
- ✅ Link targets are URL-encoded (spaces as `%20`)
- ✅ Filenames in links are consistent with actual step file names

## Complete Example

```markdown
# Generate Lesson Plan

This flow creates a complete, standards-aligned lesson plan tailored to your classroom context and learning objectives.

1. [Set Learning Objectives](1.Set%20Learning%20Objectives.md)
2. [Choose Teaching Methods](2.Choose%20Teaching%20Methods.md)
3. [Design Activities](3.Design%20Activities.md)
4. [Create Assessment](4.Create%20Assessment.md)
5. [Format the Plan](5.Format%20the%20Plan.md)
6. [Final Review](6.Final%20Review.md)
```
