#!/usr/bin/env python3
from __future__ import annotations


VALID_STATUS_LABELS = {
    "DONE",
    "NEEDS_CONTINUE",
    "BLOCKED",
    "NEEDS_DECISION",
}


def parse_status_label(text: str) -> str | None:
    for line in text.splitlines():
        candidate = line.strip()
        if not candidate:
            continue
        if candidate in VALID_STATUS_LABELS:
            return candidate
        return None
    return None
