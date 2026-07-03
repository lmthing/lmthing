#!/usr/bin/env bash
#
# schedule.sh — install/remove the "every 5 hours" schedule for run.sh.
#
# Two mechanisms; pick one:
#   ./schedule.sh cron-install     # add a crontab entry (fires at 00:00,05:00,10:00,... )
#   ./schedule.sh cron-remove      # remove it
#   ./schedule.sh loop             # foreground loop (one app every 5h) — run under nohup/tmux
#   ./schedule.sh status           # show current schedule + last logs
#
# The loop mode gives exact 5-hour spacing and is the recommended way for a laptop
# that stays on; cron survives reboots but the */5 hour field resets each midnight
# (fires 00,05,10,15,20 then 00 — a 4h gap once per day), which is fine for this task.
#
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$SCRIPT_DIR/run.sh"
CRON_LOG="$SCRIPT_DIR/logs/cron.log"
CRON_TAG="# lmthing-app-builder"
CRON_LINE="0 */5 * * * $RUN >> $CRON_LOG 2>&1 $CRON_TAG"

case "${1:-}" in
  cron-install)
    ( crontab -l 2>/dev/null | grep -v "$CRON_TAG"; echo "$CRON_LINE" ) | crontab -
    echo "installed crontab entry:"; echo "  $CRON_LINE"
    echo "logs → $CRON_LOG"
    ;;
  cron-remove)
    crontab -l 2>/dev/null | grep -v "$CRON_TAG" | crontab -
    echo "removed lmthing-app-builder crontab entry."
    ;;
  loop)
    exec "$RUN" --loop "${@:2}"
    ;;
  status)
    echo "== crontab =="; crontab -l 2>/dev/null | grep "$CRON_TAG" || echo "(no cron entry)"
    echo; echo "== recent logs =="; ls -t "$SCRIPT_DIR"/logs/*.log 2>/dev/null | head -5 || echo "(none yet)"
    ;;
  *)
    sed -n '2,20p' "$0"; exit 1 ;;
esac
