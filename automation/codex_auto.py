#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from automation.codex_plan_cycle import format_cycle_summary, run_plan_cycle


DEFAULT_LOG_FILE = Path("automation/automation-run-log.md")


def append_run_log(summary: str, log_file: Path = DEFAULT_LOG_FILE) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat(timespec="seconds")
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write(f"## {timestamp}\n")
        handle.write(summary)
        handle.write("\n\n")


def main(log_file: Path = DEFAULT_LOG_FILE) -> int:
    try:
        result = run_plan_cycle()
        summary = format_cycle_summary(result)
        append_run_log(summary, log_file)
        print(summary)
        return 0
    except Exception as exc:  # pragma: no cover - covered via mocked test
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
