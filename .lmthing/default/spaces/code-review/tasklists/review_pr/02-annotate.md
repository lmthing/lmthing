---
id: annotate
dependsOn:
  - read_diff
forEach: read_diff.files
output:
  comments: array
---

Inspect each file patch and identify issues according to review standards. Output the generated comments as `comments`.