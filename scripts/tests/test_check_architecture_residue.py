import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "check_architecture_residue.py"
SPEC = importlib.util.spec_from_file_location("architecture_residue", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_identity_category_detects_active_source_residue():
    path = ROOT / "app" / "desktop" / "src" / "main" / "residue-fixture.ts"
    violations = MODULE.scan_text(path, "const ownerId = currentUserId;\n")

    assert {(item.rule_category, item.term) for item in violations} == {
        ("user_identity_residue", "ownerId"),
        ("user_identity_residue", "currentUserId"),
    }


def test_identity_category_ignores_historical_and_test_text():
    historical = ROOT / "documentation" / "decisions" / "ADR-0020.md"
    test_source = ROOT / "app" / "desktop" / "test" / "residue.test.mjs"

    assert MODULE.scan_text(historical, "ownerId userId") == []
    assert MODULE.scan_text(test_source, "ownerId userId") == []


def test_category_choices_are_derived_from_rules():
    assert "user_identity_residue" in MODULE.CATEGORY_CHOICES
    assert "generation_service_business_leak" in MODULE.CATEGORY_CHOICES
