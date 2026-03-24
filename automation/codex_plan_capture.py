#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys


DEFAULT_OUTPUT_FILE = Path("automation/latest_plan_output.md")


def main() -> int:
    content = sys.stdin.read().strip()

    if not content:
        print("ERROR: no plan output provided on stdin", file=sys.stderr)
        return 2

    DEFAULT_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_OUTPUT_FILE.write_text(f"{content}\n", encoding="utf-8")

    print("CAPTURED")
    print(f"Output: {DEFAULT_OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
