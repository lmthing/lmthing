#!/usr/bin/env bash
# Spawn one fleet subagent on demand into a NEW herdr pane.
#
# start-agent-fleet.sh creates the 'fleet' workspace with only the orchestrator;
# this script grows the fleet one pane at a time. It is idempotent: if <name> is
# already alive it prints the existing pane id and touches nothing.
#
# Usage: devops/scripts/spawn-agent.sh <name> [--from <pane-id>] [--direction right|down]
#
# The roster lives here (keep in sync with .claude/agent-fleet.md).
# The final stdout line is always: "<name> <pane-id>"
set -euo pipefail

ROSTER=(claudez pi-glm pi-glm-flash pi-luna pi-terra pi-deepseek-flash agy)
# pi-deepseek-flash, pi-glm-flash and claudez may also be spawned as <name>-2 … -9 for parallel fan-out.

usage() {
  echo "usage: devops/scripts/spawn-agent.sh <name> [--from <pane-id>] [--direction right|down]" >&2
  echo "  names: ${ROSTER[*]}" >&2
}

# roster <name> -> sets KIND and ARGS; fails for an unknown name
roster() {
  case "$1" in
    claudez|claudez-[2-9])   KIND=claude; ARGS=(--settings "${HOME}/.claude/zai-settings.json" --dangerously-skip-permissions) ;;
    pi-glm)            KIND=pi; ARGS=(--model zai/glm-5.3) ;;
    pi-glm-flash|pi-glm-flash-[2-9]) KIND=pi; ARGS=(--model zai/glm-5.3-flash) ;;
    pi-luna)           KIND=pi; ARGS=(--model azure-responses/gpt-5.6-luna) ;;
    pi-terra)          KIND=pi; ARGS=(--model azure-responses/gpt-5.6-terra) ;;
    pi-deepseek-flash|pi-deepseek-flash-[2-9]) KIND=pi; ARGS=(--model azure-chat/DeepSeek-V4-Flash-0731) ;;
    agy)               KIND=agy; ARGS=(--model gemini-3.7-flash --effort medium) ;;
    *) return 1 ;;
  esac
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# --- arguments -----------------------------------------------------------------
NAME="" FROM="" DIRECTION=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from)      FROM="${2:?--from needs a pane id}"; shift 2 ;;
    --direction) DIRECTION="${2:?--direction needs right or down}"; shift 2 ;;
    -h|--help)   usage; exit 0 ;;
    --*)         echo "error: unknown option '$1'" >&2; usage; exit 1 ;;
    *) [ -z "${NAME}" ] || { echo "error: unexpected argument '$1'" >&2; usage; exit 1; }; NAME="$1"; shift ;;
  esac
done

[ -n "${NAME}" ] || { usage; exit 1; }
roster "${NAME}" || { echo "error: unknown agent '${NAME}' — valid names: ${ROSTER[*]}" >&2; exit 1; }
case "${DIRECTION}" in ''|right|down) ;; *) echo "error: --direction must be 'right' or 'down'" >&2; exit 1 ;; esac

# --- preflight (same as start-agent-fleet.sh) -----------------------------------
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
# start-agent-fleet.sh).
agents_json="$(herdr agent list)"

agent_pane() { # $1 = agent name -> its pane_id ("" when that agent is not alive)
  printf '%s' "${agents_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const a=(j.result.agents||[]).find(x=>x.name===process.argv[1]);console.log(a?a.pane_id:"")})' "$1"
}

subagent_panes() { # -> the roster agents' pane_ids, oldest first, one per line
  printf '%s' "${agents_json}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const names=new Set(process.argv.slice(1));for(const id of (j.result.agents||[]).filter(x=>names.has(x.name)).map(x=>x.pane_id).sort((a,b)=>Number(a.split(":p")[1])-Number(b.split(":p")[1])))console.log(id)})' "${ROSTER[@]}"
}

pane_id() { # stdin = any herdr response carrying .result.pane -> its pane_id
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.result.pane.pane_id)})'
}

# --- idempotency: already alive? -------------------------------------------------
existing="$(agent_pane "${NAME}")"
if [ -n "${existing}" ]; then
  echo "${NAME} ${existing}"
  exit 0
fi

# --- where to split ---------------------------------------------------------------
orch_pane="$(agent_pane orchestrator)"
[ -n "${orch_pane}" ] || orch_pane="$(herdr pane current | pane_id)"

src="${FROM}"
[ -n "${src}" ] || src="${orch_pane}"
dir="${DIRECTION}"
if [ -z "${dir}" ]; then
  newest="$(subagent_panes | tail -n 1)"
  if [ -z "${newest}" ]; then
    dir="right"                       # first subagent: open a second column
  else
    dir="down"                        # later ones stack under the newest subagent
    [ -n "${FROM}" ] || src="${newest}"
  fi
fi

# --- split a fresh shell pane and start the agent in it ---------------------------
# AGENT_BROWSER_SESSION gives this agent its OWN agent-browser instance; without it
# every pane drives the one default browser and they clobber each other's page.
new_pane="$(herdr pane split --pane "${src}" --direction "${dir}" --cwd "${repo_root}" --no-focus \
  --env "AGENT_BROWSER_SESSION=${NAME}" | pane_id)"

if ! herdr agent start "${NAME}" --kind "${KIND}" --pane "${new_pane}" -- "${ARGS[@]}" >/dev/null; then
  echo "error: herdr agent start failed for '${NAME}' — closing pane ${new_pane}" >&2
  herdr pane close "${new_pane}" >/dev/null 2>&1 || true
  exit 1
fi

echo "${NAME} ${new_pane}"
