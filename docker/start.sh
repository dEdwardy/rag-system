#!/bin/sh
set -eu

node /app/apps/api/scripts/start-prod.mjs &
api_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

cleanup() {
  kill "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap cleanup INT TERM

status=0

while :; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    wait "$api_pid" || status=$?
    break
  fi

  if ! kill -0 "$nginx_pid" 2>/dev/null; then
    wait "$nginx_pid" || status=$?
    break
  fi

  sleep 1
done

cleanup
wait || true

exit "$status"
