---
id: gather
output:
  shares: array
  labs: array
  medications: array
  insights: array
  appointments: array
  contacts: array
dependsOn: []
role: general
---

Self-query the pending `care_shares` rows and the record each one's summary is compiled from.
`where` is equality-only, so filter/sort in memory beyond an exact match:

```ts
const shares = db.query('care_shares', { where: { status: 'pending' } });
const flaggedLabs = db.query('lab_results', {}).filter((l) => l.flag !== 'normal');
const activeMeds = db.query('medications', {}).filter((m) => !m.endedAt);
const adherenceLogs = db.query('adherence_logs', {});
```

Compute each active medication's recent adherence from its own scored dose logs — leave
`adherencePct` unset when there isn't any scored history yet, never guess one:

```ts
const medications = activeMeds.map((m) => {
  const logs = adherenceLogs.filter((a) => a.medicationId === m.id);
  const scored = logs.filter((a) => a.status === 'taken' || a.status === 'missed' || a.status === 'skipped');
  const adherencePct = scored.length > 0
    ? Math.round((scored.filter((a) => a.status === 'taken').length / scored.length) * 100)
    : undefined;
  return { name: m.name, dose: m.dose, schedule: m.schedule, adherencePct };
});
```

Gather the rest of the record — recent insights, upcoming appointments, and the care team:

```ts
const insights = db.query('insights', {})
  .slice()
  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  .slice(0, 5)
  .map((i) => ({ body: i.body }));
const now = new Date();
const appointments = db.query('appointments', { where: { status: 'scheduled' } })
  .filter((a) => new Date(a.scheduledAt) >= now)
  .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
  .map((a) => ({ title: a.title, provider: a.provider, scheduledAt: a.scheduledAt }));
const contacts = db.query('care_contacts', {})
  .map((c) => ({ name: c.name, role: c.role, organization: c.organization, phone: c.phone }));
const labs = flaggedLabs.map((l) => ({ analyte: l.analyte, value: l.value, unit: l.unit, flag: l.flag }));
currentTask.resolve({ shares, labs, medications, insights, appointments, contacts });
```
