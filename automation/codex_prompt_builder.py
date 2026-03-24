#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


DEFAULT_PROMPT_FILE = Path("automation/codex_prompt.md")
DEFAULT_SKIP_QUEUE_FILE = Path("automation/automation-skip-queue.md")
DEFAULT_RUNTIME_PROMPT_FILE = Path("automation/runtime_prompt.md")


def parse_skipped_increments(queue_text: str) -> list[str]:
    increments: list[str] = []
    lines = queue_text.splitlines()
    index = 0

    while index < len(lines):
        line = lines[index].strip()
        if line == "Increment:":
            index += 1
            collected: list[str] = []
            while index < len(lines) and lines[index].strip():
                collected.append(lines[index].strip())
                index += 1
            if collected:
                increments.append(" ".join(collected))
        index += 1

    return increments


def build_runtime_prompt(prompt_path: Path, skip_queue_path: Path) -> str:
    base_prompt = prompt_path.read_text(encoding="utf-8")

    if not skip_queue_path.exists():
        return base_prompt

    skipped = parse_skipped_increments(skip_queue_path.read_text(encoding="utf-8"))
    if not skipped:
        return base_prompt

    exclusion_lines = [
        "",
        "Automation skip queue:",
        "Do not select any increment that matches the skipped core tasks listed below.",
        "Instead, choose the next most appropriate non-core minimal increment.",
        "",
        "Skipped tasks:",
    ]
    exclusion_lines.extend(f"- {item}" for item in skipped)
    exclusion_lines.append("")

    return base_prompt.rstrip() + "\n" + "\n".join(exclusion_lines)


def main() -> int:
    runtime_prompt = build_runtime_prompt(DEFAULT_PROMPT_FILE, DEFAULT_SKIP_QUEUE_FILE)
    DEFAULT_RUNTIME_PROMPT_FILE.write_text(runtime_prompt, encoding="utf-8")
    print("BUILT")
    print(f"Output: {DEFAULT_RUNTIME_PROMPT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
