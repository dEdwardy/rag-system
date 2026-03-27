#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
service_name="opencode-loop.service"
timer_name="opencode-loop.timer"

usage() {
  cat <<'EOF'
Usage: control.sh <start|stop|status>

start  Enable the timer and launch the loop immediately.
stop   Stop the service and disable the timer.
status Show the service and timer status.
EOF
}

systemctl_user() {
  systemctl --user "$@"
}

case "${1:-}" in
  start)
    cd "$repo_root"
    systemctl_user daemon-reload
    systemctl_user enable --now "$timer_name"
    systemctl_user start "$service_name"
    ;;
  stop)
    systemctl_user stop "$service_name"
    systemctl_user disable --now "$timer_name"
    ;;
  status)
    systemctl_user status --no-pager "$service_name" "$timer_name"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 2
    ;;
esac
