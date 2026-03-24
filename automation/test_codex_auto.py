import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from automation import codex_auto


class CodexAutoTest(unittest.TestCase):
    @patch("automation.codex_auto.format_cycle_summary")
    @patch("automation.codex_auto.run_plan_cycle")
    def test_main_prints_summary_and_returns_zero(
        self,
        mock_run_plan_cycle,
        mock_format_cycle_summary,
    ) -> None:
        mock_run_plan_cycle.return_value = {"status": "ALLOW"}
        mock_format_cycle_summary.return_value = "summary text"

        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "automation-log.md"
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                exit_code = codex_auto.main(log_file=log_path)

            self.assertEqual(exit_code, 0)
            self.assertEqual(stdout.getvalue(), "summary text\n")
            self.assertIn("summary text", log_path.read_text(encoding="utf-8"))
            mock_run_plan_cycle.assert_called_once()
            mock_format_cycle_summary.assert_called_once_with({"status": "ALLOW"})

    @patch("automation.codex_auto.run_plan_cycle")
    def test_main_returns_nonzero_when_cycle_raises(self, mock_run_plan_cycle) -> None:
        mock_run_plan_cycle.side_effect = RuntimeError("boom")

        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "automation-log.md"
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                exit_code = codex_auto.main(log_file=log_path)

            self.assertEqual(exit_code, 1)
            self.assertIn("ERROR: boom", stdout.getvalue())
            self.assertFalse(log_path.exists())


if __name__ == "__main__":
    unittest.main()
