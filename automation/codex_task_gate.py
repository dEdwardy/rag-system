#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys


CORE_KEYWORDS = [
    "retrieval",
    "answering",
    "ingestion",
    "streaming",
    "schema",
    "persistence",
    "shared contract",
    "shared contracts",
    "packages/shared",
    "prisma",
]

CORE_PATH_PREFIXES = [
    "apps/api/src/modules/retrieval/",
    "apps/api/src/modules/answering/",
    "apps/api/src/modules/ingestion/",
    "apps/api/src/infra/llm/",
    "apps/api/prisma/",
    "packages/shared/",
]

DEFAULT_INPUT_FILE = Path("automation/latest_plan_output.md")
DEFAULT_QUEUE_FILE = Path("automation/automation-skip-queue.md")


def normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


def detect_core_hits(text: str) -> list[str]:
    normalized = normalize_text(text)
    hits: list[str] = []

    for keyword in CORE_KEYWORDS:
        if keyword in normalized:
            hits.append(f"keyword:{keyword}")

    for prefix in CORE_PATH_PREFIXES:
        if prefix in normalized:
            hits.append(f"path:{prefix}")

    return hits


def append_skip_record(queue_path: Path, increment_text: str, hits: list[str]) -> None:
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat(timespec="seconds")
    with queue_path.open("a", encoding="utf-8") as handle:
        handle.write(f"## {timestamp}\n")
        handle.write("Status: SKIP\n")
        handle.write(f"Hits: {', '.join(hits)}\n")
        handle.write("Increment:\n")
        handle.write(f"{increment_text.strip()}\n\n")


def load_increment_text() -> str:
    if not sys.stdin.isatty():
        stdin_text = sys.stdin.read().strip()
        if stdin_text:
            return stdin_text

    if DEFAULT_INPUT_FILE.exists():
        return DEFAULT_INPUT_FILE.read_text(encoding="utf-8").strip()

    return ""


def main() -> int:
    increment_text = load_increment_text()

    if not increment_text:
        print(
            f"ERROR: no increment text found in stdin or {DEFAULT_INPUT_FILE}",
            file=sys.stderr,
        )
        return 2

    hits = detect_core_hits(increment_text)
    queue_path = DEFAULT_QUEUE_FILE

    if hits:
        append_skip_record(queue_path, increment_text, hits)
        print("SKIP")
        print(f"Input: {DEFAULT_INPUT_FILE}")
        print(f"Queue: {queue_path}")
        print(f"Hits: {', '.join(hits)}")
        return 0

    print("ALLOW")
    print(f"Input: {DEFAULT_INPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
