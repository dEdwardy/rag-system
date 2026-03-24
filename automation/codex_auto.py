#!/usr/bin/env python3
from __future__ import annotations

from automation.codex_plan_cycle import format_cycle_summary, run_plan_cycle


def main() -> int:
    try:
        result = run_plan_cycle()
        print(format_cycle_summary(result))
        return 0
    except Exception as exc:  # pragma: no cover - covered via mocked test
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
