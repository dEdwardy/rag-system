#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

export PATH="$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found on PATH; install pnpm or adjust PATH before enabling opencode-loop." >&2
  exit 127
fi

cd "$repo_root"
exec pnpm opencode:loop
