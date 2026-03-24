#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import subprocess


DEFAULT_WORKSPACE_ROOT = Path.cwd()
DEFAULT_PROMPT_FILE = Path("automation/runtime_prompt.md")
DEFAULT_OUTPUT_FILE = Path("automation/latest_plan_output.md")


def resolve_codex_command() -> str:
    return shutil.which("codex.cmd") or shutil.which("codex") or "codex"


def build_exec_command(workspace_root: Path, output_file: Path = DEFAULT_OUTPUT_FILE) -> list[str]:
    return [
        resolve_codex_command(),
        "exec",
        "-C",
        str(workspace_root),
        "--sandbox",
        "read-only",
        "-o",
        str(output_file),
        "-",
    ]


def run_plan(
    workspace_root: Path = DEFAULT_WORKSPACE_ROOT,
    prompt_file: Path = DEFAULT_PROMPT_FILE,
    output_file: Path = DEFAULT_OUTPUT_FILE,
) -> None:
    prompt_text = prompt_file.read_text(encoding="utf-8")
    command = build_exec_command(workspace_root, output_file)
    subprocess.run(command, input=prompt_text, text=True, check=True)


def main() -> int:
    run_plan()
    print("RAN")
    print(f"Prompt: {DEFAULT_PROMPT_FILE}")
    print(f"Output: {DEFAULT_OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
