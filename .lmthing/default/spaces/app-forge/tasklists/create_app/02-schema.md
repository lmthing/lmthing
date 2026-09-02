---
id: schema
dependsOn:
  - scaffold
output:
  tables: array
---

Author the tables. Load `project/layout/database` first — the rules live there. One JSON table per concept: basename = snake_case table name, required `description`, one `primaryKey` column, required `type` + `description` on every column, `references`/`relations` for how tables link. Author through `writeProjectTable` (`db:schema`); the third arg seeds rows only when the app needs starting data. A column the views will filter or sort by must exist HERE — inventing it later in a view is how an app ends up with an always-null binding. Record the table names as `tables`.