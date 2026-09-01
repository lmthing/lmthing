---
id: report
goal: true
dependsOn: [discover, persist]
role: plan
functions: []
output:
  summary: string
  ruleCount: number
  ok: boolean
---

Report what binding found and created, from upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Found ${discover.candidateCount} utility queue tables in this project. ` +
    `Created ${persist.inserted} dispatch rules (${persist.skippedExisting} already existed). ` +
    (persist.inserted > 0
      ? `Each is 'proposed' with no channel — run the dispatcher's rules action to attach and test a messaging channel before anything is delivered.`
      : `Nothing new to configure.`),
  ruleCount: discover.candidateCount,
  ok: persist.ok === true,
});
```

Zero candidates is a normal outcome — report it plainly, never as a failure.
