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
    def test_removed_web_client_cannot_be_described_as_current(self) -> None:
        errors = CHECKER.desktop_only_invariant_errors(
            Path("fixture.md"),
            "app/frontend-web remains a temporary parity reference.",
            frontend_web_exists=False,
        )
        self.assertTrue(errors)

    def test_removed_drive_contract_is_forbidden_in_current_docs(self) -> None:
        text = "Desktop final video is stored in Google Drive."
        matches = [
            label for label, pattern in CHECKER.FORBIDDEN.items() if pattern.search(text)
        ]
        self.assertIn("removed Google Drive storage contract", matches)

    def test_removed_server_render_contract_is_forbidden_in_current_docs(self) -> None:
        text = "The render-worker uploads the final artifact."
        matches = [
            label for label, pattern in CHECKER.FORBIDDEN.items() if pattern.search(text)
        ]
        self.assertIn("removed final-video server storage contract", matches)


if __name__ == "__main__":
    unittest.main()
