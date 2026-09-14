from __future__ import annotations

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src"

FORBIDDEN_TERMS = (
    "asyncpg",
    "database_url",
    "generation_jobs",
    "stage_attempts",
    "provider_operations",
    "narration_operations",
    "visual_beats",
    "project_id",
    "chapter_id",
    "scene_id",
)


def test_production_source_has_no_business_database_dependency() -> None:
    source = "\n".join(file.read_text(encoding="utf-8").lower() for file in SOURCE.rglob("*.py"))
    assert not [term for term in FORBIDDEN_TERMS if term in source]


def test_runtime_dependencies_have_no_database_driver() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    dependencies = "\n".join(project["project"]["dependencies"]).lower()
    assert not re.search(r"asyncpg|psycopg|postgres|sqlalchemy|mybatis|spring-data", dependencies)


def test_worker_has_no_legacy_package_import() -> None:
    source = "\n".join(file.read_text(encoding="utf-8") for file in SOURCE.rglob("*.py"))
    assert "narrativex_worker" not in source


def test_worker_contract_has_no_database_environment() -> None:
    combined = "\n".join(
        file.read_text(encoding="utf-8")
        for file in (ROOT / "..").resolve().glob("gpu-worker/*")
        if file.is_file()
    )
    assert "DATABASE_URL" not in combined
