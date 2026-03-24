#!/usr/bin/env python3
from __future__ import annotations

import argparse
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gate a proposed next increment and skip core tasks."
    )
    parser.add_argument(
        "text",
        nargs="?",
        help="Proposed next increment text. If omitted, read from stdin.",
    )
    parser.add_argument(
        "--queue-file",
        default="automation/automation-skip-queue.md",
        help="Path to the local skip queue markdown file.",
    )
    args = parser.parse_args()

    increment_text = args.text if args.text is not None else sys.stdin.read()
    increment_text = increment_text.strip()

    if not increment_text:
        print("ERROR: no increment text provided", file=sys.stderr)
        return 2

    hits = detect_core_hits(increment_text)
    queue_path = Path(args.queue_file)

    if hits:
        append_skip_record(queue_path, increment_text, hits)
        print("SKIP")
        print(f"Queue: {queue_path}")
        print(f"Hits: {', '.join(hits)}")
        return 0

    print("ALLOW")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
