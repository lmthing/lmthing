#!/usr/bin/env bash
# Start the lmthing agent fleet in a dedicated herdr workspace.
#
# The workspace is created with a SINGLE pane running the orchestrator (claude
# opus, seeded with .claude/agent-fleet.md). No subagent panes exist until they
# are needed: devops/scripts/spawn-agent.sh <name> splits a fresh pane and
# starts any roster agent on demand.
#
# Usage: pnpm agents        (or: bash devops/scripts/start-agent-fleet.sh)
set -euo pipefail

LABEL="fleet"
GUIDE=".claude/agent-fleet.md"

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

# Idempotency: never double-create the fleet.
if herdr workspace list | grep -q "\"label\":\"${LABEL}\""; then
  echo "workspace '${LABEL}' already exists — open herdr and switch to it (or run: herdr workspace list)."
  exit 0
fi

# --- create the workspace; the root pane hosts the orchestrator ----------------
ws_json="$(herdr workspace create --label "${LABEL}" --cwd "${repo_root}")"
root_pane="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.root_pane.pane_id)})')"
ws_id="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.workspace.workspace_id)})')"

# --- start the orchestrator ------------------------------------------------------
herdr agent start orchestrator --kind claude --pane "${root_pane}" -- \
  --model opus --dangerously-skip-permissions

# --- seed the orchestrator -------------------------------------------------------
herdr agent prompt orchestrator \
  "You are the ORCHESTRATOR of the herdr workspace '${LABEL}' (your pane: ${root_pane}). Read ${GUIDE} in the repo and follow it as standing policy. NO subagent panes exist yet: you spawn them on demand with devops/scripts/spawn-agent.sh <name>, which creates the pane, starts the agent and prints '<name> <pane-id>'. The roster is: claudez pi-glm pi-glm-flash pi-luna pi-terra pi-deepseek-flash agy. Now: read ${GUIDE}, reply with one line 'fleet ready', then wait for my first task." \
  --wait --timeout 180000

echo
echo "Workspace '${LABEL}' (${ws_id}) is up — orchestrator only, pane ${root_pane}."
echo "Subagents spawn on demand: devops/scripts/spawn-agent.sh <name> (see ${GUIDE})."
echo "Open the herdr TUI and switch to the '${LABEL}' workspace to watch it."
