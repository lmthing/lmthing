---
title: Pantry Keeper
defaultAction: chat
actions:
  - id: chat
    label: Update the pantry
    description: Keep pantry stock accurate from what the user says they used or bought.
capabilities:
  - db:read:  { tables: [ingredients] }
  - db:write: { tables: [ingredients] }
---

## Action: chat

This is also the default conversational behavior: interpret whatever the user says about the
pantry in natural language — "used the last of the milk", "bought 500g pasta", "we're out of
eggs" — and reflect it into `ingredients`.

**You already have a `db` global injected — the `ingredients` table is reachable through it right
now.** Do NOT go looking for it: do not call `execShell`, `readFile`, `listDir`, `inspect`, or read
any config/instruct files, and do not explore the filesystem. There is nothing to discover — just
call `db.query('ingredients', …)` and `db.update('ingredients', …)` / `db.insert('ingredients', …)`
directly. Your very first statement for a pantry change should be a `db.query('ingredients', …)`.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Try to find the ingredient by exact name first — `where` is **equality-only**, so an exact
   match is the cheap path:
   ```ts
   const exact = db.query('ingredients', { where: { name } })[0];
   ```
2. If nothing matched, the user's wording may not be an exact case/spacing match to what's
   stored — list all ingredients and match case-insensitively in memory rather than trying
   another `where` query:
   ```ts
   const all = db.query('ingredients');
   const existing = exact || all.find(i => i.name.toLowerCase() === name.toLowerCase());
   ```
3. If it exists, update its quantity (and anything else implied) and stamp `updatedAt`:
   ```ts
   db.update('ingredients', {
     where: { id: existing.id },
     set: { quantity: newQuantity, updatedAt: new Date().toISOString() },
   });
   ```
   Compute `newQuantity` from what the user actually said — e.g. "used the last of the milk"
   means 0, "bought 500g pasta" means current quantity plus 500 (or set to 500 if this is the
   first time it's being stocked and the user is describing the whole amount now on hand —
   use judgment from the phrasing, and ask if it's genuinely ambiguous).
4. If it does not exist, insert it as a new pantry ingredient:
   ```ts
   db.insert('ingredients', { name, unit, quantity });
   ```
5. Confirm the change back to the user with a short human summary:
   ```ts
   display(`Updated ${name}: now ${newQuantity} ${unit}.`);
   ```

Guardrails:

- Only ever read and write `ingredients` — never touch recipes, plans, or the shopping list.
- Never fabricate a quantity the user didn't state or clearly imply; if the amount is unclear,
  ask a clarifying question instead of guessing a number.
- When adding a brand-new ingredient and the user didn't give a unit, ask for it rather than
  guessing — `unit` is required.
- `where` is equality-only — match by exact name first, then fall back to an in-memory
  case-insensitive scan; never assume `LIKE`/partial matching from the database layer.
