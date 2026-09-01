## Running a tasklist

Walk a run with `start_task` and `complete_task` — run state is persisted per (project, space, agent, tasklist) under `.lmthing/<project>/.runs/`, so a reconnected harness asks the server where it is instead of remembering.

Out-of-order calls are REFUSED with guidance naming what is ready now; restarting a finished node returns its recorded output instead of redoing work. Complete a node with its declared `output:` fields — downstream nodes receive them as `inputs`. `condition` and `forEach` are free text the driving model interprets against those inputs.