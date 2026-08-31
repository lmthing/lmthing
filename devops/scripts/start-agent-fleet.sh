#!/usr/bin/env bash
# Start the lmthing agent fleet in a dedicated herdr workspace:
#
#   ┌───────────────────┬──────────┬─────────┐
#   │ orchestrator      │ claudez  │ pi-glm- │
#   │ (claude opus)     ├──────────┤ flash   │
#   │                   │ pi-luna  ├─────────┤
#   ├───────────────────┤          │ agy     │
#   │ pi-glm            ├──────────┤         │
#   │ (zai/glm-5.3)     │ pi-terra │         │
#   │                   ├──────────┤         │
#   │                   │ pi-deep- │         │
#   │                   │ seek     │         │
#   └───────────────────┴──────────┴─────────┘
#
# The orchestrator is seeded with .claude/agent-fleet.md and owns all task
# routing; the seven subagents sit idle until it prompts them.
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
pane_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.pane.pane_id)})'; }

ws_json="$(herdr workspace create --label "${LABEL}" --cwd "${repo_root}")"
root_pane="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.root_pane.pane_id)})')"
ws_id="$(printf '%s' "${ws_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.workspace.workspace_id)})')"

split() { # $1 = source pane, $2 = direction -> prints new pane id
  herdr pane split --pane "$1" --direction "$2" --cwd "${repo_root}" --no-focus | pane_id
}

# Three columns: col1 (50%) orchestrator/pi-glm, col2 (25%) four rows, col3 (25%) two rows.
col2="$(split "${root_pane}" right)"
col3="$(split "${col2}" right)"
pane_pi_glm="$(split "${root_pane}" down)"

c2_top="$(split "${col2}" down)"
pane_claudez="$(split "${c2_top}" down)"   # row 1; c2_top becomes row 2
pane_pi_luna="${c2_top}"
pane_pi_terra="$(split "${col2}" down)"    # row 3; col2 becomes row 4
pane_pi_deepseek="${col2}"

pane_agy="$(split "${col3}" down)"         # col3 bottom; col3 remains top
pane_pi_glm_flash="${col3}"

# --- start the agents ---------------------------------------------------------
herdr agent start orchestrator --kind claude --pane "${root_pane}" -- \
  --model opus --dangerously-skip-permissions

herdr agent start claudez --kind claude --pane "${pane_claudez}" -- \
  --settings "${HOME}/.claude/zai-settings.json" --dangerously-skip-permissions

herdr agent start pi-glm --kind pi --pane "${pane_pi_glm}" -- \
  --model zai/glm-5.3

herdr agent start pi-luna --kind pi --pane "${pane_pi_luna}" -- \
  --model azure-responses/gpt-5.6-luna

herdr agent start pi-terra --kind pi --pane "${pane_pi_terra}" -- \
  --model azure-responses/gpt-5.6-terra

herdr agent start pi-deepseek-flash --kind pi --pane "${pane_pi_deepseek}" -- \
  --model azure-chat/DeepSeek-V4-Flash-0731

herdr agent start pi-glm-flash --kind pi --pane "${pane_pi_glm_flash}" -- \
  --model zai/glm-5.3-flash

herdr agent start agy --kind agy --pane "${pane_agy}" -- \
  --model gemini-3.7-flash --effort medium

# --- seed the orchestrator ----------------------------------------------------
herdr agent prompt orchestrator \
  "You are the ORCHESTRATOR of this 8-pane agent fleet (herdr workspace ${LABEL}). Read ${GUIDE} in the repo and follow it as standing policy: you always achieve tasks by delegating to the subagents claudez, pi-glm, pi-luna, pi-terra, pi-deepseek-flash, pi-glm-flash and agy. Pane ids: orchestrator=${root_pane} claudez=${pane_claudez} pi-glm=${pane_pi_glm} pi-luna=${pane_pi_luna} pi-terra=${pane_pi_terra} pi-deepseek-flash=${pane_pi_deepseek} pi-glm-flash=${pane_pi_glm_flash} agy=${pane_agy}. Now: run \`herdr agent list\`, confirm all eight agents are present, reply with one line 'fleet ready' + anything that is NOT idle, then wait for my first task." \
  --wait --timeout 180000

echo
echo "Fleet '${LABEL}' (${ws_id}) is up:"
echo "  ${root_pane}         orchestrator        claude opus (you talk to this one)"
echo "  ${pane_claudez}         claudez             claude on zai glm-5.3"
echo "  ${pane_pi_glm}         pi-glm              pi on zai/glm-5.3"
echo "  ${pane_pi_luna}         pi-luna             pi on azure gpt-5.6-luna"
echo "  ${pane_pi_terra}         pi-terra            pi on azure gpt-5.6-terra"
echo "  ${pane_pi_deepseek}         pi-deepseek-flash   pi on azure DeepSeek-V4-Flash-0731"
echo "  ${pane_pi_glm_flash}         pi-glm-flash        pi on zai/glm-5.3-flash"
echo "  ${pane_agy}         agy                 agy on gemini-3.7-flash (medium)"
echo "Open the herdr TUI and switch to the '${LABEL}' workspace to watch it."
