# scenario-dash client

Runs on the machine that owns the campaign ledger + Claude transcripts
(`automation/instances/scenario-campaign/`, `sdk/org/scenarios/`) and **pushes**
snapshots + live transcript tails to the cluster-side dashboard
(`automation/app`, served at `https://lmthing.cloud/scenario-dash`). The cluster
can't reach behind a home NAT, so push is one-way from here.

## Run (via lmauto — the normal way)

```bash
node automation/lmauto.mjs client up        # start (detached, survives the shell); pushes to prod
node automation/lmauto.mjs client status     # is it running?
node automation/lmauto.mjs client down       # stop
node automation/lmauto.mjs client token      # print the DASH_VIEW_TOKEN (read from the cluster)
```

`client up` resolves the token automatically from the cluster's `lmthing-secrets`
(via `devops/scripts/cluster-kubectl.sh`), so you don't need to pass it. The daemon
PID + log live under `automation/client/.run/` (gitignored).

Flags: `--app-url URL` (default `https://lmthing.cloud`), `--token TOK` (override),
`--instance NAME` (default `scenario-campaign`).

### Finding the token manually

The dashboard's shared secret is `DASH_VIEW_TOKEN` in the `lmthing-secrets` k8s
secret. Print it with `lmauto client token`, or directly:

```bash
./devops/scripts/cluster-kubectl.sh get secret lmthing-secrets -n lmthing \
  -o 'jsonpath={.data.DASH_VIEW_TOKEN}' | base64 -d; echo
```

Paste it into the dashboard's unlock screen at `https://lmthing.cloud/scenario-dash/`.

## Run directly (without lmauto)

```bash
node automation/client/client.mjs --app-url http://localhost:3000 --token <DASH_VIEW_TOKEN>
```

Env equivalents: `DASH_APP_URL`, `DASH_VIEW_TOKEN`.

## What it syncs

- `state.json` → ledger (rounds/runs/costs/outcomes) — every 2s on change.
- `state/runtime.json` → live engine state (slots/bins) — every 2s on change.
- `harness/.state/users/*.json` → label→userId map (the scenario↔pod join).
- each scenario's `scenario.md` + `results/checkpoint.json` — every 4s on change.
- each attempt's `result.json` / `output.log` / `prompt.md` / `PROGRESS.md`.
- **live tail** of every active attempt's `output.jsonl` (the Claude `-p`
  transcript) — streamed in batches every 0.5s.

Zero deps (Node 24 global `fetch`). Polling-based for Linux robustness.
