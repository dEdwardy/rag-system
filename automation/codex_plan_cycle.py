#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from automation.codex_plan_runner import run_plan
from automation.codex_prompt_builder import (
    DEFAULT_PROMPT_FILE,
    DEFAULT_RUNTIME_PROMPT_FILE,
    DEFAULT_SKIP_QUEUE_FILE,
    build_runtime_prompt,
)
from automation.codex_status_parser import parse_status_label
from automation.codex_task_gate import (
    DEFAULT_INPUT_FILE,
    DEFAULT_QUEUE_FILE,
    append_skip_record,
    detect_core_hits,
    load_increment_text,
)


def run_single_plan_attempt(timeout_seconds: int = 300) -> dict[str, object]:
    runtime_prompt = build_runtime_prompt(DEFAULT_PROMPT_FILE, DEFAULT_SKIP_QUEUE_FILE)
    DEFAULT_RUNTIME_PROMPT_FILE.write_text(runtime_prompt, encoding="utf-8")

    run_plan(
        prompt_file=DEFAULT_RUNTIME_PROMPT_FILE,
        output_file=DEFAULT_INPUT_FILE,
        timeout_seconds=timeout_seconds,
    )

    increment_text = load_increment_text()
    agent_status = parse_status_label(increment_text)
    hits = detect_core_hits(increment_text)

    if hits:
        append_skip_record(DEFAULT_QUEUE_FILE, increment_text, hits)
        return {
            "status": "SKIP",
            "agent_status": agent_status,
            "hits": hits,
            "increment": increment_text,
        }

    return {
        "status": "ALLOW",
        "agent_status": agent_status,
        "hits": [],
        "increment": increment_text,
    }


def run_plan_cycle(timeout_seconds: int = 300) -> dict[str, object]:
    first_result = run_single_plan_attempt(timeout_seconds=timeout_seconds)

    if (
        first_result["status"] == "ALLOW"
        and first_result["agent_status"] == "NEEDS_CONTINUE"
    ):
        second_result = run_single_plan_attempt(timeout_seconds=timeout_seconds)
        second_result["attempts"] = 2
        second_result["auto_continued"] = True
        return second_result

    first_result["attempts"] = 1
    first_result["auto_continued"] = False
    return first_result


def get_suggested_action(result: dict[str, object]) -> str:
    if result["status"] == "SKIP":
        return "review skip queue"

    agent_status = result["agent_status"]
    if agent_status == "DONE":
        return "start a new session"
    if agent_status == "NEEDS_CONTINUE":
        return "rerun the cycle or inspect why more work remains"
    if agent_status == "BLOCKED":
        return "inspect the blocking reason"
    if agent_status == "NEEDS_DECISION":
        return "make the required decision"

    return "inspect latest plan output"


def format_cycle_summary(result: dict[str, object]) -> str:
    lines = [
        f"Cycle status: {result['status']}",
        f"Agent status: {result['agent_status'] or 'UNKNOWN'}",
        f"Attempts: {result['attempts']}",
        f"Auto-continued: {'yes' if result['auto_continued'] else 'no'}",
        f"Increment: {result['increment']}",
        f"Input: {DEFAULT_INPUT_FILE}",
        f"Suggested action: {get_suggested_action(result)}",
    ]

    if result["status"] == "SKIP":
        lines.append(f"Queue: {DEFAULT_QUEUE_FILE}")
        lines.append(f"Hits: {', '.join(result['hits'])}")

    return "\n".join(lines)


def main() -> int:
    result = run_plan_cycle()
    print(format_cycle_summary(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
