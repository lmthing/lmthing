---
title: Validation Checklist
description: Complete checklist to verify a workspace is correctly structured before testing
order: 2
---

# Validation Checklist

Before testing a workspace in the Studio, verify all of these. One broken reference can cause silent failures.

---

## 📦 Package

- [ ] `package.json` exists at the workspace root
- [ ] `name` field is `{slug}-demo` in kebab-case
- [ ] `version` is `"1.0.0"`
- [ ] `private` is boolean `true`
- [ ] JSON is valid (no trailing commas)

---

## 🤖 Agents

For each `agents/agent-{name}/`:

- [ ] Folder name uses `agent-` prefix + `kebab-case`
- [ ] `config.json` exists and is valid JSON
- [ ] `instruct.md` exists with valid YAML frontmatter
- [ ] `values.json` exists (can be `{}`)
- [ ] `name` in frontmatter is `PascalCase`
- [ ] All `enabledKnowledgeFields` values start with `"domain-"`
- [ ] All `enabledKnowledgeFields` reference existing `knowledge/` folder names
- [ ] All `flowId` values in `<slash_action>` reference existing `flows/` folder names
- [ ] All slash command strings start with `/`
- [ ] No duplicate slash commands across actions
- [ ] All tools use `kebab-case`
- [ ] `runtimeFields` domain keys match existing `knowledge/` folder names
- [ ] `runtimeFields` field arrays match existing `knowledge/{domain}/` folder names

---

## 🔄 Flows

For each `flows/flow_{id}/`:

- [ ] Folder uses `flow_` prefix + `snake_case`
- [ ] `index.md` exists
- [ ] `index.md` has an H1 title
- [ ] `index.md` has a description paragraph
- [ ] Numbered step list matches actual step files (count and names)
- [ ] Step links use URL-encoded filenames (spaces → `%20`)
- [ ] Each step file `N.Name.md` exists for every N in `index.md`
- [ ] Steps are sequentially numbered with no gaps
- [ ] Each step file has an H1 heading

---

## 🧠 Knowledge Base

For each `knowledge/{domain}/`:

- [ ] `config.json` exists and is valid JSON
- [ ] `label` is human-readable Title Case
- [ ] `icon` is exactly one emoji
- [ ] `color` is a valid 7-char hex code (`#rrggbb`)
- [ ] `renderAs` is `"section"`

For each `knowledge/{domain}/{field}/`:

- [ ] `config.json` exists and is valid JSON
- [ ] `fieldType` is one of: `"select"`, `"multiSelect"`, `"text"`
- [ ] `variableName` is `camelCase`
- [ ] `renderAs` is `"field"`
- [ ] `default` references an existing option file slug (if `fieldType` is select/multiSelect)
- [ ] `required` is boolean (not string)

For each option `.md` file:

- [ ] Frontmatter has `title`, `description`, `order`
- [ ] `order` is an integer
- [ ] YAML frontmatter is valid (no tabs, proper indentation)
- [ ] Body content is substantive (not just a title)
- [ ] Filename is `kebab-case.md`

---

## 🔗 Cross-Reference Checks

These must be checked across files:

- [ ] Every `enabledKnowledgeFields` entry → has a matching `knowledge/{domain}/` folder
- [ ] Every `flowId` → has a matching `flows/flow_{id}/index.md`
- [ ] Every `default` in field config → has a matching `{slug}.md` in the field folder
- [ ] Every `runtimeFields` → domain + field path exists

---

## Quick Consistency Test (via Thing Panel)

In the Thing panel, type `status` to get an automated workspace overview. This shows:

- Agent count and listing
- Flow count and listing
- Knowledge domain count
- Any detected configuration issues
