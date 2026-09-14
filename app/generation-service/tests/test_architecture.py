from __future__ import annotations

import ast
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


def _imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            modules.add(node.module)
    return modules


def test_domain_lifecycle_core_is_framework_and_adapter_free() -> None:
    core = SOURCE / "narrativex_gpu_worker" / "domain" / "execution_attempt.py"
    imports = _imports(core)
    assert not {module for module in imports if module.startswith("pydantic")}
    assert not {
        module
        for module in imports
        if module.startswith(("fastapi", "httpx", "sqlite3", "narrativex_gpu_worker.adapters"))
    }


def test_domain_package_does_not_eagerly_import_protocol_frameworks() -> None:
    init = SOURCE / "narrativex_gpu_worker" / "domain" / "__init__.py"
    imports = _imports(init)
    assert "pydantic" not in imports
    assert "narrativex_gpu_worker.domain.models" not in imports


def test_application_core_does_not_depend_on_concrete_adapters() -> None:
    application = SOURCE / "narrativex_gpu_worker" / "application"
    imports = {module for path in application.rglob("*.py") for module in _imports(path)}
    assert not {module for module in imports if module.startswith("narrativex_gpu_worker.adapters")}


def test_executor_implementation_has_one_canonical_package() -> None:
    package = SOURCE / "narrativex_gpu_worker"
    assert not (package / "executors").exists()
    assert (package / "adapters" / "executors").is_dir()
