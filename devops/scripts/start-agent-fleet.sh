#!/usr/bin/env bash
# Start the lmthing agent fleet in a dedicated herdr workspace:
#
#   ┌────────────────┬─────────┐
#   │ orchestrator   │ claudez │
#   │ (claude opus)  ├─────────┤
#   │                │ pi-luna │
#   ├────────────────┤         │
#   │ pi-glm         │         │
#   └────────────────┴─────────┘
#
# The orchestrator is seeded with .claude/agent-fleet.md and owns all task
# routing; the three subagents sit idle until it prompts them.
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

# --- create the workspace; panes come back as JSON ---------------------------
ws_json="$(herdr workspace create --label "${LABEL}" --cwd "${repo_root}")"
root_pane="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.root_pane.pane_id)})')"
ws_id="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.workspace.workspace_id)})')"

split() { # $1 = source pane, $2 = direction -> prints new pane id
  herdr pane split --pane "$1" --direction "$2" --cwd "${repo_root}" --no-focus \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.pane.pane_id)})'
}

# 2x2 grid: split the full-height right column, then split each column down.
right_col="$(split "${root_pane}" right)"
pane_claudez="$(split "${right_col}" down)"
pane_pi_glm="$(split "${root_pane}" down)"
pane_pi_luna="${right_col}"

# --- start the agents ---------------------------------------------------------
herdr agent start orchestrator --kind claude --pane "${root_pane}" -- \
  --model opus --dangerously-skip-permissions

herdr agent start claudez --kind claude --pane "${pane_claudez}" -- \
  --settings "${HOME}/.claude/zai-settings.json" --dangerously-skip-permissions

herdr agent start pi-glm --kind pi --pane "${pane_pi_glm}" -- \
  --model zai/glm-5.3

herdr agent start pi-luna --kind pi --pane "${pane_pi_luna}" -- \
  --model azure-responses/gpt-5.6-luna

# --- seed the orchestrator ----------------------------------------------------
herdr agent prompt orchestrator \
  "You are the ORCHESTRATOR of this 4-pane agent fleet (herdr workspace ${LABEL}). Read ${GUIDE} in the repo and follow it as standing policy: you always achieve tasks by delegating to the subagents claudez, pi-glm and pi-luna. Pane ids: orchestrator=${root_pane} claudez=${pane_claudez} pi-glm=${pane_pi_glm} pi-luna=${pane_pi_luna}. Now: run \`herdr agent list\`, confirm all four agents are present, reply with one line 'fleet ready' + anything that is NOT idle, then wait for my first task." \
  --wait --timeout 180000

echo
echo "Fleet '${LABEL}' (${ws_id}) is up:"
echo "  ${root_pane}   orchestrator   claude opus (you talk to this one)"
echo "  ${pane_claudez}   claudez        claude on zai glm-5.3"
echo "  ${pane_pi_glm}   pi-glm         pi on zai/glm-5.3"
echo "  ${pane_pi_luna}   pi-luna        pi on azure gpt-5.6-luna"
echo "Open the herdr TUI and switch to the '${LABEL}' workspace to watch it."
