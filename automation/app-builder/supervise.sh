#!/usr/bin/env bash
#
# supervise.sh — time-boxed driver for the autonomous app-builder.
#
# Waits until a start time, then runs one build (run.sh, round-robin over the apps)
# every INTERVAL seconds until a hard DEADLINE, then stops. Absolute START/DEADLINE epochs
# are persisted so a restart resumes the same window instead of extending it.
#
# Env (all optional):
#   START_DELAY     seconds until the first run        (default 7200  = 2h)
#   DURATION        total window from launch, seconds  (default 172800 = 2 days)
#   RUN_INTERVAL    seconds between run starts         (default 18000 = 5h)
#   START_EPOCH     absolute start  (overrides START_DELAY; used on restart)
#   DEADLINE_EPOCH  absolute stop   (overrides DURATION;    used on restart)
#
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
LOG_DIR="$SCRIPT_DIR/logs"
STATUS="$STATE_DIR/supervisor.status"
PIDFILE="$STATE_DIR/supervisor.pid"
mkdir -p "$STATE_DIR" "$LOG_DIR"

START_DELAY="${START_DELAY:-7200}"
DURATION="${DURATION:-172800}"
RUN_INTERVAL="${RUN_INTERVAL:-18000}"

now="$(date +%s)"
START_EPOCH="${START_EPOCH:-$(( now + START_DELAY ))}"
DEADLINE_EPOCH="${DEADLINE_EPOCH:-$(( now + DURATION ))}"

echo $$ > "$PIDFILE"

log() { echo "[$(date -Is)] $*"; }

write_status() {
  cat > "$STATUS" <<EOF
pid=$$
launched=$(date -Is -d "@$now" 2>/dev/null || date -Is)
start=$(date -Is -d "@$START_EPOCH")
deadline=$(date -Is -d "@$DEADLINE_EPOCH")
start_epoch=$START_EPOCH
deadline_epoch=$DEADLINE_EPOCH
interval_seconds=$RUN_INTERVAL
state=$1
last_run=${2:-none}
next_run=${3:-}
updated=$(date -Is)
EOF
}

# interruptible sleep until an absolute epoch (checks the deadline as it waits)
sleep_until() {
  local target="$1"
  while :; do
    local n; n="$(date +%s)"
    [ "$n" -ge "$target" ] && return 0
    [ "$n" -ge "$DEADLINE_EPOCH" ] && return 1   # deadline passed while waiting
    local remain=$(( target - n ))
    sleep $(( remain < 60 ? remain : 60 ))
  done
}

# Only touch the shared pidfile/status if WE still own the pidfile — otherwise a late-firing
# trap from a just-killed supervisor would clobber a newer supervisor's files (relaunch race).
own_pidfile() { [ "$(cat "$PIDFILE" 2>/dev/null)" = "$$" ]; }
cleanup_if_owner() { if own_pidfile; then write_status "$1"; rm -f "$PIDFILE"; fi; }

trap 'log "supervisor stopping (signal)"; cleanup_if_owner stopped; exit 0' INT TERM

log "supervisor up. start=$(date -Is -d "@$START_EPOCH")  deadline=$(date -Is -d "@$DEADLINE_EPOCH")  interval=${RUN_INTERVAL}s"
write_status waiting-for-start none "$(date -Is -d "@$START_EPOCH")"

if ! sleep_until "$START_EPOCH"; then
  log "deadline reached before start window — nothing to do"; cleanup_if_owner done; exit 0
fi

run_count=0
while :; do
  now="$(date +%s)"
  if [ "$now" -ge "$DEADLINE_EPOCH" ]; then
    log "deadline reached — stopping after $run_count run(s)"; break
  fi
  run_count=$(( run_count + 1 ))
  log "=== starting build #$run_count ==="
  write_status "running-build-#$run_count" "$(date -Is)" ""
  RUN_INTERVAL="$RUN_INTERVAL" "$SCRIPT_DIR/run.sh" || log "run.sh exited non-zero (continuing)"
  log "=== build #$run_count finished ==="

  now="$(date +%s)"
  local_next=$(( now + RUN_INTERVAL ))
  if [ "$local_next" -ge "$DEADLINE_EPOCH" ]; then
    log "next run would be past the deadline — stopping after $run_count run(s)"; break
  fi
  write_status "sleeping" "$(date -Is)" "$(date -Is -d "@$local_next")"
  log "sleeping ${RUN_INTERVAL}s → next build at $(date -Is -d "@$local_next")"
  sleep_until "$local_next" || { log "deadline reached during sleep — stopping"; break; }
done

if own_pidfile; then write_status done "$(date -Is)" ""; rm -f "$PIDFILE"; fi
log "supervisor done."
