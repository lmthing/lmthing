#!/usr/bin/env bash
#
# run.sh — one autonomous Claude Code run that builds/ships one project-application.
#
# Invoked by the scheduler every 5 hours (see schedule.sh). Each invocation targets
# ONE app (round-robin over health → blog → kitchen → trips), so each 5-hour session
# stays focused. Override the app by passing its name as $1.
#
# Usage:
#   ./run.sh                 # next app in the round-robin
#   ./run.sh health          # force a specific app
#   ./run.sh --loop          # run forever, one app every RUN_INTERVAL seconds (default 5h)
#   ./run.sh --loop kitchen  # loop but always the same app
#
# Env overrides:
#   CLAUDE_MODEL      claude model for the BUILDER (default: unset → your configured default)
#   RUN_INTERVAL      seconds between --loop runs (default 18000 = 5h)
#   CLAUDE_BIN        path to the claude CLI (default: claude on PATH)
#
set -uo pipefail

# --- locate things ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
LOG_DIR="$SCRIPT_DIR/logs"
COUNTER_FILE="$STATE_DIR/counter"
ENV_FILE="$REPO_ROOT/sdk/org/.env"
mkdir -p "$STATE_DIR" "$LOG_DIR"

CLAUDE_BIN="${CLAUDE_BIN:-claude}"
RUN_INTERVAL="${RUN_INTERVAL:-18000}"   # 5 hours

# app -> spec file, project-scoped space name (from the specs)
APPS=(blog kitchen health trips)
declare -A SPEC=(
  [health]=health-application.md
  [blog]=blog-application.md
  [kitchen]=kitchen-application.md
  [trips]=trips-application.md
)
declare -A SPACE=(
  [health]=clinic
  [blog]=newsroom
  [kitchen]=chef
  [trips]=concierge
)

# --- pick the model from sdk/org/.env (the LIVE model the app is tested with) ---
pick_model() {
  local alias model
  # prefer the default LM_MODEL alias if set, else fall back to S (deepseek small)
  alias="$(grep -E '^LM_MODEL=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]')"
  [ -z "$alias" ] && alias="S"
  model="$(grep -E "^LM_MODEL_${alias}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '[:space:]')"
  [ -z "$model" ] && model="$(grep -E '^LM_MODEL_S=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '[:space:]')"
  MODEL_ALIAS="$alias"
  MODEL_VALUE="${model:-unknown}"
}

# --- choose which app this run targets, and which ROUND it is --------------
# A "round" is one full pass over all four apps. Round 1 = core build;
# round >= 2 = feature-expansion (revisit each app and grow it a lot).
choose_app() {
  local forced="${1:-}"
  local n="${#APPS[@]}"
  local idx=0
  [ -f "$COUNTER_FILE" ] && idx="$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)"
  [[ "$idx" =~ ^[0-9]+$ ]] || idx=0

  if [ -n "$forced" ] && [ -n "${SPEC[$forced]:-}" ]; then
    APP="$forced"
    ROUND=$(( idx / n + 1 ))          # forced run does not advance the counter
    return
  fi
  APP="${APPS[$((idx % n))]}"
  ROUND=$(( idx / n + 1 ))
  echo "$(( idx + 1 ))" > "$COUNTER_FILE"
}

# --- run one autonomous build ----------------------------------------------
one_run() {
  local forced="${1:-}"
  choose_app "$forced"
  pick_model

  local spec="${SPEC[$APP]}" space="${SPACE[$APP]}"
  local round_mode
  if [ "${ROUND:-1}" -le 1 ]; then round_mode="CORE BUILD"; else round_mode="FEATURE EXPANSION"; fi
  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local log="$LOG_DIR/${APP}-r${ROUND}-${ts}.log"

  # Materialize the prompt from the template.
  local prompt
  prompt="$(sed \
      -e "s|__APP__|${APP}|g" \
      -e "s|__SPEC_FILE__|${spec}|g" \
      -e "s|__SPACE__|${space}|g" \
      -e "s|__ROUND__|${ROUND}|g" \
      -e "s|__ROUND_MODE__|${round_mode}|g" \
      -e "s|__MODEL_ALIAS__|${MODEL_ALIAS}|g" \
      -e "s|__MODEL__|${MODEL_VALUE}|g" \
      "$SCRIPT_DIR/prompt.tmpl.md")"

  echo "==============================================================="  | tee -a "$log"
  echo " autonomous app-builder"                                          | tee -a "$log"
  echo "   app          : $APP"                                           | tee -a "$log"
  echo "   round        : $ROUND ($round_mode)"                           | tee -a "$log"
  echo "   spec         : app-specifications/$spec"                       | tee -a "$log"
  echo "   live model   : $MODEL_VALUE (alias $MODEL_ALIAS)"              | tee -a "$log"
  echo "   started      : $(date -Is)"                                    | tee -a "$log"
  echo "   log          : $log"                                           | tee -a "$log"
  echo "==============================================================="  | tee -a "$log"

  # Keep the working tree current before an autonomous session (best-effort).
  ( cd "$REPO_ROOT" && git pull --ff-only --recurse-submodules 2>&1 ) | tee -a "$log" || true

  local model_arg=()
  [ -n "${CLAUDE_MODEL:-}" ] && model_arg=(--model "$CLAUDE_MODEL")

  # Headless, fully autonomous. --dangerously-skip-permissions: no prompts.
  # --verbose so the log shows turn-by-turn progress across the long run.
  ( cd "$REPO_ROOT" && \
    "$CLAUDE_BIN" -p "$prompt" \
      --dangerously-skip-permissions \
      --verbose \
      --add-dir "$REPO_ROOT/sdk/org" \
      "${model_arg[@]}" \
  ) 2>&1 | tee -a "$log"
  local rc=${PIPESTATUS[0]}

  echo "--- finished $APP at $(date -Is) (exit $rc) ---" | tee -a "$log"
  return $rc
}

# --- entrypoint ------------------------------------------------------------
LOOP=0
FORCED_APP=""
for arg in "$@"; do
  case "$arg" in
    --loop) LOOP=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) FORCED_APP="$arg" ;;
  esac
done

if [ "$LOOP" -eq 1 ]; then
  echo "loop mode: one run every ${RUN_INTERVAL}s. Ctrl-C to stop."
  while true; do
    one_run "$FORCED_APP" || echo "run exited non-zero; continuing loop"
    echo "sleeping ${RUN_INTERVAL}s until next run ($(date -Is))..."
    sleep "$RUN_INTERVAL"
  done
else
  one_run "$FORCED_APP"
fi
