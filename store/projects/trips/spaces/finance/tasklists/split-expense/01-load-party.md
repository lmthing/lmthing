---
id: load_party
output:
  travelerIds: array
  amount: number
  currency: string
dependsOn: []
role: plan
---

Load the expense being split and the full traveler roster for its trip. `expenseId` is in scope
from the tasklist input.

```ts
const expense = db.query('expenses', { where: { id: expenseId } })[0];
const travelers = db.query('travelers', { where: { tripId: expense.tripId } });

currentTask.resolve({
  travelerIds: travelers.map(t => t.id),
  amount: expense.amount,
  currency: expense.currency,
});
```
