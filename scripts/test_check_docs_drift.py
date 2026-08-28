#!/usr/bin/env python3
"""Focused regression tests for scripts/check-docs-drift.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
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
        matches = [label for label, pattern in CHECKER.FORBIDDEN.items() if pattern.search(text)]
        self.assertIn("removed Google Drive storage contract", matches)

    def test_removed_server_render_contract_is_forbidden_in_current_docs(self) -> None:
        text = "The render-worker uploads the final artifact."
        matches = [label for label, pattern in CHECKER.FORBIDDEN.items() if pattern.search(text)]
        self.assertIn("removed final-video server storage contract", matches)

    def test_redis_not_required_wording_is_allowed(self) -> None:
        text = "Redis is not required by the MVP runtime."
        matches = [label for label, pattern in CHECKER.FORBIDDEN.items() if pattern.search(text)]
        self.assertNotIn("Redis described as required current runtime", matches)

    def test_redis_required_wording_is_forbidden(self) -> None:
        text = "Redis is required by the MVP runtime."
        matches = [label for label, pattern in CHECKER.FORBIDDEN.items() if pattern.search(text)]
        self.assertIn("Redis described as required current runtime", matches)

    def test_decision_index_must_list_every_adr(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            decisions = Path(temp)
            (decisions / "ADR-0001-example.md").write_text("# ADR", encoding="utf-8")
            index = decisions / "README.md"
            index.write_text("# Decision ledger\n", encoding="utf-8")
            errors = CHECKER.decision_index_errors(decisions, index)
        self.assertEqual(
            errors,
            ["documentation/decisions/README.md does not index ADR-0001-example.md"],
        )

    def test_plan_index_requires_lifecycle_status(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            plans = Path(temp)
            (plans / "2026-01-01-example.md").write_text("# Plan", encoding="utf-8")
            index = plans / "README.md"
            index.write_text(
                "| Plan | Status | Purpose |\n"
                "| --- | --- | --- |\n"
                "| 2026-01-01-example.md | UNKNOWN | x |\n",
                encoding="utf-8",
            )
            errors = CHECKER.plan_index_errors(plans, index)
        self.assertEqual(len(errors), 1)
        self.assertIn("ACTIVE/COMPLETED/SUPERSEDED", errors[0])

    def test_plan_index_accepts_active_plan(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            plans = Path(temp)
            plan = plans / "2026-01-01-example.md"
            plan.write_text("# Plan", encoding="utf-8")
            index = plans / "README.md"
            index.write_text(
                "| Plan | Status | Purpose |\n"
                "| --- | --- | --- |\n"
                "| [2026-01-01-example.md](./2026-01-01-example.md) | ACTIVE | x |\n",
                encoding="utf-8",
            )
            errors = CHECKER.plan_index_errors(plans, index)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
