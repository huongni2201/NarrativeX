#!/usr/bin/env python3
"""Focused regression tests for scripts/check-docs-drift.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = ROOT / "scripts" / "check-docs-drift.py"
SPEC = importlib.util.spec_from_file_location("check_docs_drift", CHECKER_PATH)
assert SPEC and SPEC.loader
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class DocsDriftCheckerTest(unittest.TestCase):
    def fixture(self, name: str) -> str:
        return (ROOT / "scripts" / "fixtures" / "docs-drift" / name).read_text(encoding="utf-8")

    def test_negative_drive_assertion_is_not_reported(self) -> None:
        self.assertFalse(
            CHECKER.contains_desktop_drive_assertion(
                self.fixture("desktop-final-drive-negative.md")
            )
        )

    def test_positive_drive_assertion_is_reported(self) -> None:
        self.assertTrue(
            CHECKER.contains_desktop_drive_assertion(
                self.fixture("desktop-final-drive-positive.md")
            )
        )

    def test_paraphrased_positive_drive_assertion_is_reported(self) -> None:
        self.assertTrue(
            CHECKER.contains_desktop_drive_assertion(
                self.fixture("desktop-final-drive-paraphrase.md")
            )
        )

    def test_removed_web_client_cannot_be_described_as_current(self) -> None:
        errors = CHECKER.desktop_only_invariant_errors(
            Path("fixture.md"),
            "app/frontend-web remains a temporary parity reference.",
            frontend_web_exists=False,
        )
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
