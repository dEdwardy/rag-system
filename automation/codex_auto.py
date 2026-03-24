#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from automation.codex_plan_runner import DEFAULT_TIMEOUT_SECONDS
from automation.codex_plan_cycle import format_cycle_summary, run_plan_cycle


DEFAULT_LOG_FILE = Path("automation/automation-run-log.md")


def append_run_log(summary: str, log_file: Path = DEFAULT_LOG_FILE) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat(timespec="seconds")
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write(f"## {timestamp}\n")
        handle.write(summary)
        handle.write("\n\n")


def main(
    log_file: Path = DEFAULT_LOG_FILE,
    write_log: bool = True,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> int:
    try:
        result = run_plan_cycle(timeout_seconds=timeout_seconds)
        summary = format_cycle_summary(result)
        if write_log:
            append_run_log(summary, log_file)
        print(summary)
        return 0
    except Exception as exc:  # pragma: no cover - covered via mocked test
        print(f"ERROR: {exc}")
        return 1


def cli() -> int:
    parser = argparse.ArgumentParser(description="Run the Codex automation entrypoint.")
    parser.add_argument(
        "--no-log",
        action="store_true",
        help="Do not append the summary to the local automation run log.",
    )
    parser.add_argument(
        "--log-file",
        default=str(DEFAULT_LOG_FILE),
        help="Custom path for the local automation run log.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="Timeout in seconds for a single codex exec attempt.",
    )
    args = parser.parse_args()
    return main(
        log_file=Path(args.log_file),
        write_log=not args.no_log,
        timeout_seconds=args.timeout,
    )


if __name__ == "__main__":
    raise SystemExit(cli())
