import unittest
from unittest.mock import patch

from automation.codex_plan_cycle import format_cycle_summary, run_plan_cycle


class CodexPlanCycleTest(unittest.TestCase):
    @patch("automation.codex_plan_cycle.load_increment_text")
    @patch("automation.codex_plan_cycle.detect_core_hits")
    @patch("automation.codex_plan_cycle.parse_status_label")
    @patch("automation.codex_plan_cycle.run_plan")
    @patch("automation.codex_plan_cycle.build_runtime_prompt")
    def test_run_plan_cycle_auto_continues_once_for_needs_continue(
        self,
        mock_build_runtime_prompt,
        mock_run_plan,
        mock_parse_status_label,
        mock_detect_core_hits,
        mock_load_increment_text,
    ) -> None:
        mock_build_runtime_prompt.return_value = "runtime prompt"
        mock_load_increment_text.side_effect = [
            "first increment output",
            "second increment output",
        ]
        mock_parse_status_label.side_effect = ["NEEDS_CONTINUE", "DONE"]
        mock_detect_core_hits.side_effect = [[], []]

        result = run_plan_cycle()

        self.assertEqual(result["status"], "ALLOW")
        self.assertEqual(result["agent_status"], "DONE")
        self.assertEqual(result["attempts"], 2)
        self.assertTrue(result["auto_continued"])
        self.assertEqual(mock_run_plan.call_count, 2)

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
        self.assertEqual(result["attempts"], 1)
        self.assertFalse(result["auto_continued"])
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
        self.assertEqual(result["attempts"], 1)
        self.assertFalse(result["auto_continued"])
        mock_append_skip_record.assert_called_once()
        mock_run_plan.assert_called_once()

    def test_format_cycle_summary_for_allow_result(self) -> None:
        summary = format_cycle_summary(
            {
                "status": "ALLOW",
                "agent_status": "DONE",
                "hits": [],
                "increment": "update docs and small web text",
                "attempts": 1,
                "auto_continued": False,
            }
        )

        self.assertIn("Cycle status: ALLOW", summary)
        self.assertIn("Agent status: DONE", summary)
        self.assertIn("Attempts: 1", summary)
        self.assertIn("Auto-continued: no", summary)
        self.assertIn("Increment: update docs and small web text", summary)

    def test_format_cycle_summary_for_skip_result(self) -> None:
        summary = format_cycle_summary(
            {
                "status": "SKIP",
                "agent_status": "NEEDS_CONTINUE",
                "hits": ["keyword:retrieval"],
                "increment": "improve retrieval ranking",
                "attempts": 1,
                "auto_continued": False,
            }
        )

        self.assertIn("Cycle status: SKIP", summary)
        self.assertIn("Agent status: NEEDS_CONTINUE", summary)
        self.assertIn("Attempts: 1", summary)
        self.assertIn("Auto-continued: no", summary)
        self.assertIn("Hits: keyword:retrieval", summary)


if __name__ == "__main__":
    unittest.main()
