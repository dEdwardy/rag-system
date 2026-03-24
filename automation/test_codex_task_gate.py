import unittest

from automation.codex_task_gate import detect_core_hits


class CodexTaskGateTest(unittest.TestCase):
    def test_detect_core_hits_ignores_non_core_plan_explanatory_text(self) -> None:
        plan_output = """BLOCKED

I read `AGENTS.md`, the four required docs, and the current trace/backend code path.

The next minimal increment I would take is to make the trace detail page consume the existing backend `traceSummary` instead of relying mostly on raw payload and ad hoc derived fields. This fits the current repo state because:
- the backend summary is already implemented and typed in [apps/web/src/types/api.ts](/D:/FeProjects/rag-system/apps/web/src/types/api.ts)
- the current docs explicitly note that the trace UI still mainly exposes raw payload plus final score
- this is a small frontend-enablement increment on top of an already-closed backend capability, not a new architecture path and not retrieval-ranking work

Planned touch points:
- [apps/web/src/pages/traces/TraceDetailPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/traces/TraceDetailPage.tsx)
- [apps/web/src/i18n/messages.ts](/D:/FeProjects/rag-system/apps/web/src/i18n/messages.ts)
- [apps/web/test/ui-review-regressions.test.js](/D:/FeProjects/rag-system/apps/web/test/ui-review-regressions.test.js)
- [docs/current-progress.md](/D:/FeProjects/rag-system/docs/current-progress.md)
"""

        self.assertEqual(detect_core_hits(plan_output), [])

    def test_detect_core_hits_matches_core_paths_in_plan_touch_points(self) -> None:
        plan_output = """DONE

The next minimal increment I would take is to tighten retrieval ranking thresholds.

Planned touch points:
- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/test/retrieval.test.js](/D:/FeProjects/rag-system/apps/api/test/retrieval.test.js)
"""

        self.assertIn(
            "path:apps/api/src/modules/retrieval/",
            detect_core_hits(plan_output),
        )

    def test_detect_core_hits_falls_back_to_raw_text_keyword_matching(self) -> None:
        increment_text = "improve retrieval ranking in apps/api/src/modules/retrieval/ service"

        hits = detect_core_hits(increment_text)

        self.assertIn("keyword:retrieval", hits)
        self.assertIn("path:apps/api/src/modules/retrieval/", hits)


if __name__ == "__main__":
    unittest.main()
