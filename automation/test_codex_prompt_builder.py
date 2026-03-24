from pathlib import Path
import tempfile
import unittest

from automation.codex_prompt_builder import build_runtime_prompt


class CodexPromptBuilderTest(unittest.TestCase):
    def test_returns_base_prompt_when_skip_queue_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            prompt_path = temp_path / "codex_prompt.md"
            prompt_path.write_text("base prompt\n", encoding="utf-8")

            runtime_prompt = build_runtime_prompt(prompt_path, temp_path / "missing.md")

            self.assertEqual(runtime_prompt, "base prompt\n")

    def test_appends_skip_exclusion_block_when_queue_has_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            prompt_path = temp_path / "codex_prompt.md"
            queue_path = temp_path / "automation-skip-queue.md"

            prompt_path.write_text("base prompt\n", encoding="utf-8")
            queue_path.write_text(
                "## 2026-03-25T01:36:35\n"
                "Status: SKIP\n"
                "Hits: keyword:retrieval\n"
                "Increment:\n"
                "improve retrieval ranking\n\n",
                encoding="utf-8",
            )

            runtime_prompt = build_runtime_prompt(prompt_path, queue_path)

            self.assertIn("base prompt\n", runtime_prompt)
            self.assertIn("Automation skip queue:", runtime_prompt)
            self.assertIn("- improve retrieval ranking", runtime_prompt)


if __name__ == "__main__":
    unittest.main()
