#!/usr/bin/env bash
# Start — or restart — the lmthing agent fleet orchestrator in a dedicated herdr
# workspace.
#
# The fleet is ONE pane running the orchestrator (claude opus, seeded with
# .claude/agent-fleet.md). No subagent panes exist until they are needed:
# devops/scripts/spawn-agent.sh <name> splits a fresh pane and starts any roster
# agent on demand.
#
# Usage: pnpm agents [--restart]        (or: bash devops/scripts/start-agent-fleet.sh)
#
#   (no flag)  A live orchestrator is left alone. Otherwise one is started: in the
#              existing 'fleet' workspace when it is still up (any subagent panes
#              survive), in a fresh workspace when it is not. So killing the
#              orchestrator pane and re-running this is a clean restart.
#   --restart  Close the live orchestrator's pane first, then start a fresh one.
#              Run it from another pane — it refuses to close its own.
set -euo pipefail

LABEL="${FLEET_LABEL:-fleet}"
GUIDE=".claude/agent-fleet.md"
ORCH="orchestrator"

RESTART=0
while [ $# -gt 0 ]; do
  case "$1" in
    --restart) RESTART=1; shift ;;
    -h|--help) awk 'NR>1 && /^#/{sub(/^# ?/,"");print;next} NR>1{exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "error: unknown option '$1' (try --help)" >&2; exit 1 ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

command -v herdr >/dev/null 2>&1 || {
  echo "error: herdr is not installed / not on PATH" >&2
  exit 1
}

# The herdr TUI owns the server (there is no detached start); probe it.
if ! herdr workspace list >/dev/null 2>&1; then
  echo "error: herdr server not running — start it with: herdr" >&2
  exit 1
fi

# herdr answers with JSON; pull fields out with node one-liners (same style as
# spawn-agent.sh).
agent_pane() { # $1 = agent name -> its pane_id ("" when that agent is not alive)
  herdr agent list | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const a=(j.result.agents||[]).find(x=>x.name===process.argv[1]);console.log(a?a.pane_id:"")})' "$1"
}

workspace_id() { # $1 = label -> its workspace_id ("" when no such workspace)
  herdr workspace list | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const w=(j.result.workspaces||[]).find(x=>x.label===process.argv[1]);console.log(w?w.workspace_id:"")})' "$1"
}

workspace_panes() { # $1 = workspace_id; $2 = "free" -> only panes with no agent in them
  herdr pane list --workspace "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);let p=(j.result.panes||[]);if(process.argv[1]==="free")p=p.filter(x=>!x.agent);for(const id of p.map(x=>x.pane_id).sort((a,b)=>Number(a.split(":p")[1])-Number(b.split(":p")[1])))console.log(id)})' "${2:-}"
}

pane_id() { # stdin = any herdr response carrying .result.pane -> its pane_id
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.pane.pane_id)})'
}

# --- an orchestrator already alive? ----------------------------------------------
existing="$(agent_pane "${ORCH}")"
if [ -n "${existing}" ]; then
  if [ "${RESTART}" -eq 0 ]; then
    echo "${ORCH} is already running in pane ${existing} — re-run with --restart to replace it."
    exit 0
  fi
  if [ "${HERDR_PANE_ID:-}" = "${existing}" ]; then
    echo "error: --restart would close the pane this script is running in (${existing}) — run it from another pane." >&2
    exit 1
  fi
  echo "closing the old ${ORCH} pane ${existing}…"
  herdr pane close "${existing}" >/dev/null
  # The name is only free once herdr has reaped the agent; give it a moment.
  for _ in $(seq 1 25); do
    [ -z "$(agent_pane "${ORCH}")" ] && break
    sleep 0.2
  done
  [ -z "$(agent_pane "${ORCH}")" ] || {
    echo "error: pane ${existing} closed but agent '${ORCH}' is still registered" >&2
    exit 1
  }
fi

# --- pick the pane the orchestrator will live in ----------------------------------
# AGENT_BROWSER_SESSION gives the orchestrator its OWN agent-browser instance;
# without it every pane drives the one default browser and they clobber each
# other's page.
ws="$(workspace_id "${LABEL}")"
fresh_pane=0

if [ -z "${ws}" ]; then
  ws_json="$(herdr workspace create --label "${LABEL}" --cwd "${repo_root}" --env "AGENT_BROWSER_SESSION=${ORCH}")"
  ws="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.workspace.workspace_id)})')"
  pane="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.root_pane.pane_id)})')"
  fresh_pane=1
  echo "created workspace '${LABEL}' (${ws})"
else
  # The workspace survived (subagents still in it): reuse a pane that is back at a
  # free shell — a killed orchestrator leaves one — else split a new one.
  pane="$(workspace_panes "${ws}" free | head -n 1)"
  if [ -n "${pane}" ]; then
    herdr pane run "${pane}" "export AGENT_BROWSER_SESSION=${ORCH}" >/dev/null
    echo "reusing free pane ${pane} in workspace '${LABEL}' (${ws})"
  else
    src="$(workspace_panes "${ws}" | head -n 1)"
    [ -n "${src}" ] || { echo "error: workspace '${LABEL}' (${ws}) has no panes to split from" >&2; exit 1; }
    pane="$(herdr pane split --pane "${src}" --direction right --cwd "${repo_root}" --no-focus \
      --env "AGENT_BROWSER_SESSION=${ORCH}" | pane_id)"
    fresh_pane=1
    echo "split pane ${pane} in workspace '${LABEL}' (${ws})"
  fi
fi

# --- start the orchestrator ------------------------------------------------------
if ! herdr agent start "${ORCH}" --kind claude --pane "${pane}" -- \
  --model opus --dangerously-skip-permissions >/dev/null; then
  echo "error: herdr agent start failed for '${ORCH}' in pane ${pane}" >&2
  [ "${fresh_pane}" -eq 1 ] && herdr pane close "${pane}" >/dev/null 2>&1
  exit 1
fi

# --- seed the orchestrator -------------------------------------------------------
herdr agent prompt "${ORCH}" \
  "You are the ORCHESTRATOR of the herdr workspace '${LABEL}' (your pane: ${pane}). Read ${GUIDE} in the repo and follow it as standing policy. You spawn subagent panes on demand with devops/scripts/spawn-agent.sh <name>, which creates the pane, starts the agent and prints '<name> <pane-id>'. The roster is: claudez pi-glm pi-glm-flash pi-luna pi-terra pi-deepseek-flash agy. Some of them may ALREADY be alive from an earlier orchestrator — run 'herdr agent list' first and reuse whoever is there instead of respawning. Now: read ${GUIDE}, reply with one line 'fleet ready', then wait for my first task." \
  --wait --timeout 180000

echo
echo "Workspace '${LABEL}' (${ws}) is up — ${ORCH} in pane ${pane}."
echo "Subagents spawn on demand: devops/scripts/spawn-agent.sh <name> (see ${GUIDE})."
echo "Open the herdr TUI and switch to the '${LABEL}' workspace to watch it."
