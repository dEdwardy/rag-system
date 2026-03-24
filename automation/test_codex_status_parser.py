import unittest

from automation.codex_status_parser import parse_status_label


class CodexStatusParserTest(unittest.TestCase):
    def test_parses_done_status_from_first_non_empty_line(self) -> None:
        text = "\nDONE\nincrement complete\n"
        self.assertEqual(parse_status_label(text), "DONE")

    def test_parses_needs_continue_status(self) -> None:
        text = "NEEDS_CONTINUE\nmore work remains\n"
        self.assertEqual(parse_status_label(text), "NEEDS_CONTINUE")

    def test_parses_blocked_status(self) -> None:
        text = "BLOCKED\nmissing dependency\n"
        self.assertEqual(parse_status_label(text), "BLOCKED")

    def test_parses_needs_decision_status(self) -> None:
        text = "NEEDS_DECISION\nchoose one option\n"
        self.assertEqual(parse_status_label(text), "NEEDS_DECISION")

    def test_returns_none_when_no_status_label_found(self) -> None:
        text = "No explicit status line here\n"
        self.assertIsNone(parse_status_label(text))


if __name__ == "__main__":
    unittest.main()
