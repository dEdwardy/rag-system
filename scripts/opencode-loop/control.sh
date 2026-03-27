#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
unit_dir="$repo_root/scripts/opencode-loop/systemd"
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

link_user_units() {
  for unit in "$service_name" "$timer_name"; do
    systemctl_user link --force "$unit_dir/$unit"
  done
}

case "${1:-}" in
  start)
    cd "$repo_root"
    link_user_units
    systemctl_user daemon-reload
    systemctl_user enable --now "$timer_name"
    systemctl_user start "$service_name"
    ;;
  stop)
    link_user_units
    systemctl_user stop "$service_name"
    systemctl_user disable --now "$timer_name"
    ;;
  status)
    link_user_units
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
