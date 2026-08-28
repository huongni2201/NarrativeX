#!/usr/bin/env python3
"""Focused regression tests for scripts/check-docs-checkpoint.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = ROOT / "scripts" / "check-docs-checkpoint.py"
SPEC = importlib.util.spec_from_file_location("check_docs_checkpoint", CHECKER_PATH)
assert SPEC and SPEC.loader
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class DocsCheckpointCheckerTest(unittest.TestCase):
    def test_documentation_changes_are_allowed_after_checkpoint(self) -> None:
        self.assertTrue(CHECKER.is_allowed_post_checkpoint_path("documentation/product/ROADMAP.md"))
        self.assertTrue(
            CHECKER.is_allowed_post_checkpoint_path(
                "docs/superpowers/plans/2026-08-28-example.md"
            )
        )
        self.assertTrue(CHECKER.is_allowed_post_checkpoint_path("AI_CONTEXT.md"))
        self.assertTrue(CHECKER.is_allowed_post_checkpoint_path("AGENTS.md"))
        self.assertTrue(CHECKER.is_allowed_post_checkpoint_path("app/backend-service/README.md"))
        self.assertTrue(CHECKER.is_allowed_post_checkpoint_path("scripts/verify-local.py"))

    def test_application_change_requires_checkpoint_advance(self) -> None:
        self.assertFalse(
            CHECKER.is_allowed_post_checkpoint_path(
                "app/ai-worker/src/narrativex_worker/schema.py"
            )
        )
        self.assertFalse(
            CHECKER.is_allowed_post_checkpoint_path(
                "app/backend-service/src/main/java/com/narrativex/backend/App.java"
            )
        )

    def test_non_documentation_changes_returns_only_runtime_paths(self) -> None:
        self.assertEqual(
            CHECKER.non_documentation_changes(
                [
                    "documentation/TRACEABILITY.md",
                    "scripts/check-docs-drift.py",
                    "app/desktop/src/main/main.ts",
                ]
            ),
            ["app/desktop/src/main/main.ts"],
        )


if __name__ == "__main__":
    unittest.main()
