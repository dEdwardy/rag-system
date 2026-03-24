import unittest
from unittest.mock import patch

from automation.codex_plan_cycle import run_plan_cycle


class CodexPlanCycleTest(unittest.TestCase):
    @patch("automation.codex_plan_cycle.load_increment_text")
    @patch("automation.codex_plan_cycle.detect_core_hits")
    @patch("automation.codex_plan_cycle.parse_status_label")
    @patch("automation.codex_plan_cycle.run_plan")
    @patch("automation.codex_plan_cycle.build_runtime_prompt")
    def test_run_plan_cycle_returns_allow_for_non_core_increment(
        self,
        mock_build_runtime_prompt,
        mock_run_plan,
        mock_parse_status_label,
        mock_detect_core_hits,
        mock_load_increment_text,
    ) -> None:
        mock_build_runtime_prompt.return_value = "runtime prompt"
        mock_load_increment_text.return_value = "update docs and small web text"
        mock_parse_status_label.return_value = "DONE"
        mock_detect_core_hits.return_value = []

        result = run_plan_cycle()

        self.assertEqual(result["status"], "ALLOW")
        self.assertEqual(result["agent_status"], "DONE")
        mock_build_runtime_prompt.assert_called_once()
        mock_run_plan.assert_called_once()
        mock_detect_core_hits.assert_called_once_with("update docs and small web text")

    @patch("automation.codex_plan_cycle.append_skip_record")
    @patch("automation.codex_plan_cycle.load_increment_text")
    @patch("automation.codex_plan_cycle.detect_core_hits")
    @patch("automation.codex_plan_cycle.parse_status_label")
    @patch("automation.codex_plan_cycle.run_plan")
    @patch("automation.codex_plan_cycle.build_runtime_prompt")
    def test_run_plan_cycle_records_skip_for_core_increment(
        self,
        mock_build_runtime_prompt,
        mock_run_plan,
        mock_parse_status_label,
        mock_detect_core_hits,
        mock_load_increment_text,
        mock_append_skip_record,
    ) -> None:
        mock_build_runtime_prompt.return_value = "runtime prompt"
        mock_load_increment_text.return_value = "improve retrieval ranking"
        mock_parse_status_label.return_value = "NEEDS_CONTINUE"
        mock_detect_core_hits.return_value = ["keyword:retrieval"]

        result = run_plan_cycle()

        self.assertEqual(result["status"], "SKIP")
        self.assertEqual(result["agent_status"], "NEEDS_CONTINUE")
        self.assertEqual(result["hits"], ["keyword:retrieval"])
        mock_append_skip_record.assert_called_once()
        mock_run_plan.assert_called_once()


if __name__ == "__main__":
    unittest.main()
