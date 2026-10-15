#!/usr/bin/env python3
"""Focused regression tests for scripts/check-docs-drift.py."""

from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = ROOT / "scripts" / "check-docs-drift.py"
SPEC = importlib.util.spec_from_file_location("check_docs_drift", CHECKER_PATH)
assert SPEC and SPEC.loader
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class DocsDriftCheckerTest(unittest.TestCase):
    def test_new_markdown_is_checked_before_staging_and_ignored_files_are_excluded(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "--quiet", str(root)], check=True)
            (root / ".gitignore").write_text("ignored.md\n", encoding="utf-8")
            (root / "tracked.md").write_text("Tracked documentation\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.md"], cwd=root, check=True)
            (root / "new.md").write_text("Invalid\x01 documentation\n", encoding="utf-8")
            (root / "ignored.md").write_text("Ignored\x01 artifact\n", encoding="utf-8")

            with patch.object(CHECKER, "ROOT", root):
                self.assertEqual(
                    {path.name for path in CHECKER.markdown_paths()},
                    {"tracked.md", "new.md"},
                )
                self.assertEqual(
                    CHECKER.control_character_errors(),
                    ["new.md:1: control character U+0001 is forbidden in Markdown"],
                )

    def test_current_migration_inventory_accepts_squashed_baseline_and_rejects_a_gap(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            migrations = root / "migrations"
            migrations.mkdir()
            names = [f"V{version}__fixture.sql" for version in range(1, 8)]
            for name in names:
                (migrations / name).write_text("", encoding="utf-8")
            doc = root / "documentation" / "architecture" / "DATABASE.md"
            doc.parent.mkdir(parents=True)
            doc.write_text("\n".join(names), encoding="utf-8")
            with patch.object(CHECKER, "ROOT", root):
                self.assertEqual(CHECKER.migration_inventory_errors(migrations), [])
                (migrations / "V5__fixture.sql").unlink()
                errors = CHECKER.migration_inventory_errors(migrations)
                self.assertTrue(any("not contiguous: missing V5" in error for error in errors))

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
