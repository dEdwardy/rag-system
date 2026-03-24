#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from automation.codex_plan_runner import run_plan
from automation.codex_prompt_builder import (
    DEFAULT_PROMPT_FILE,
    DEFAULT_RUNTIME_PROMPT_FILE,
    DEFAULT_SKIP_QUEUE_FILE,
    build_runtime_prompt,
)
from automation.codex_task_gate import (
    DEFAULT_INPUT_FILE,
    DEFAULT_QUEUE_FILE,
    append_skip_record,
    detect_core_hits,
    load_increment_text,
)


def run_plan_cycle() -> dict[str, object]:
    runtime_prompt = build_runtime_prompt(DEFAULT_PROMPT_FILE, DEFAULT_SKIP_QUEUE_FILE)
    DEFAULT_RUNTIME_PROMPT_FILE.write_text(runtime_prompt, encoding="utf-8")

    run_plan(prompt_file=DEFAULT_RUNTIME_PROMPT_FILE, output_file=DEFAULT_INPUT_FILE)

    increment_text = load_increment_text()
    hits = detect_core_hits(increment_text)

    if hits:
        append_skip_record(DEFAULT_QUEUE_FILE, increment_text, hits)
        return {"status": "SKIP", "hits": hits, "increment": increment_text}

    return {"status": "ALLOW", "hits": [], "increment": increment_text}


def main() -> int:
    result = run_plan_cycle()
    print(result["status"])
    print(f"Input: {DEFAULT_INPUT_FILE}")
    if result["status"] == "SKIP":
        print(f"Queue: {DEFAULT_QUEUE_FILE}")
        print(f"Hits: {', '.join(result['hits'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
