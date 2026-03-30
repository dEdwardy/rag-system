#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"

export VOLTA_HOME="${VOLTA_HOME:-$HOME/.volta}"
export PATH="$VOLTA_HOME/bin:$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"

pnpm_exec=()

for candidate in \
  "$HOME/.nvm/versions/node"/*/bin/corepack \
  "$HOME/.volta/bin/corepack" \
  /usr/bin/corepack \
  /usr/local/bin/corepack
do
  if [ -x "$candidate" ]; then
    pnpm_exec=("$candidate" pnpm)
    break
  fi
done

if [ ${#pnpm_exec[@]} -eq 0 ]; then
  for candidate in \
    "$HOME/.local/share/pnpm/pnpm" \
    "$HOME/.local/bin/pnpm"
  do
    if [ -x "$candidate" ]; then
      pnpm_exec=("$candidate")
      break
    fi
  done
fi

if [ ${#pnpm_exec[@]} -eq 0 ]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm_exec=(pnpm)
  else
    echo "pnpm was not found on PATH; install pnpm or adjust PATH before enabling opencode-loop." >&2
    exit 127
  fi
fi

cd "$repo_root"
exec "${pnpm_exec[@]}" opencode:loop
