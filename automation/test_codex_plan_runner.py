from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from automation.codex_plan_runner import (
    DEFAULT_OUTPUT_FILE,
    DEFAULT_PROMPT_FILE,
    build_exec_command,
    run_plan,
)


class CodexPlanRunnerTest(unittest.TestCase):
    def test_build_exec_command_uses_codex_exec_and_output_file(self) -> None:
        command = build_exec_command(Path("D:/FeProjects/rag-system"))

        self.assertTrue(command[0].lower().endswith("codex.cmd") or command[0] == "codex")
        self.assertEqual(command[1], "exec")
        self.assertIn("-C", command)
        self.assertIn(str(Path("D:/FeProjects/rag-system")), command)
        self.assertIn("-o", command)
        self.assertIn(str(DEFAULT_OUTPUT_FILE), command)
        self.assertIn("--sandbox", command)
        self.assertIn("read-only", command)

    @patch("automation.codex_plan_runner.subprocess.run")
    def test_run_plan_sends_prompt_text_to_codex(self, mock_run) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            prompt_path = temp_path / "runtime_prompt.md"
            output_path = temp_path / "latest_plan_output.md"
            prompt_path.write_text("plan prompt\n", encoding="utf-8")

            run_plan(Path("D:/FeProjects/rag-system"), prompt_path, output_path)

            self.assertEqual(mock_run.call_count, 1)
            _, kwargs = mock_run.call_args
            self.assertEqual(kwargs["input"], "plan prompt\n")
            self.assertTrue(kwargs["text"])
            self.assertTrue(kwargs["check"])


if __name__ == "__main__":
    unittest.main()
