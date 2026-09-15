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

FORBIDDEN_LEGACY_SYMBOLS = (
    "narrativex_gpu_worker.runtime",
    "TaskRuntime",
    "ArtifactClient",
    "ExecutionJournal",
    "ExecutorRegistry",
)


def test_production_source_has_no_business_database_dependency() -> None:
    source_files = [
        f for f in SOURCE.rglob("*.py")
        if not f.name.endswith(".pyc") and "__pycache__" not in f.parts
    ]
    assert len(source_files) > 0, "No production source files found"
    source = "\n".join(file.read_text(encoding="utf-8").lower() for file in source_files)
    assert not [term for term in FORBIDDEN_TERMS if term in source]


def test_runtime_dependencies_have_no_database_driver() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    dependencies = "\n".join(project["project"]["dependencies"]).lower()
    assert not re.search(r"asyncpg|psycopg|postgres|sqlalchemy|mybatis|spring-data", dependencies)


def test_worker_has_no_legacy_package_import() -> None:
    source = "\n".join(file.read_text(encoding="utf-8") for file in SOURCE.rglob("*.py"))
    assert "narrativex_worker" not in source


def test_worker_contract_has_no_database_environment() -> None:
    target_files = [
        file
        for file in (ROOT / "..").resolve().glob("generation-service/*")
        if file.is_file() and file.name in {"Dockerfile", "pyproject.toml", "README.md"}
    ]
    assert len(target_files) > 0, "Target configuration files must exist"
    combined = "\n".join(file.read_text(encoding="utf-8") for file in target_files)
    assert "DATABASE_URL" not in combined


def _resolved_imports(path: Path) -> set[str]:
    rel_path = path.relative_to(SOURCE).with_suffix("")
    parts = list(rel_path.parts)
    if parts[-1] == "__init__":
        parts.pop()
    package_parts = parts[:-1]

    tree = ast.parse(path.read_text(encoding="utf-8"))
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level == 0:
                if node.module:
                    modules.add(node.module)
            else:
                if node.level <= len(package_parts) + 1:
                    base = package_parts[: len(package_parts) - (node.level - 1)]
                    if node.module:
                        full_mod = ".".join(base + [node.module])
                    else:
                        full_mod = ".".join(base)
                    modules.add(full_mod)
    return modules


def test_domain_layer_is_framework_and_dependency_free() -> None:
    domain_dir = SOURCE / "narrativex_gpu_worker" / "domain"
    files = [f for f in domain_dir.glob("*.py") if f.is_file() and f.stat().st_size > 20]
    assert len(files) > 0, "Domain files must exist"
    for file in files:
        imports = _resolved_imports(file)
        forbidden = {
            m
            for m in imports
            if m.startswith((
                "pydantic",
                "fastapi",
                "httpx",
                "sqlite3",
                "narrativex_gpu_worker.application",
                "narrativex_gpu_worker.adapters",
                "narrativex_gpu_worker.contracts",
            ))
        }
        assert not forbidden, f"{file.name} imports forbidden modules: {forbidden}"


def test_contracts_layer_does_not_depend_on_inner_layers() -> None:
    contracts_dir = SOURCE / "narrativex_gpu_worker" / "contracts"
    files = [f for f in contracts_dir.glob("*.py") if f.is_file() and f.stat().st_size > 20]
    assert len(files) > 0, "Contracts files must exist"
    for file in files:
        imports = _resolved_imports(file)
        forbidden = {
            m
            for m in imports
            if m.startswith((
                "narrativex_gpu_worker.domain",
                "narrativex_gpu_worker.application",
                "narrativex_gpu_worker.adapters",
            ))
        }
        assert not forbidden, f"{file.name} imports forbidden modules: {forbidden}"


def test_application_core_does_not_depend_on_concrete_adapters() -> None:
    application = SOURCE / "narrativex_gpu_worker" / "application"
    files = [f for f in application.rglob("*.py") if f.is_file() and f.stat().st_size > 20]
    assert len(files) > 0, "Application files must exist"
    for file in files:
        imports = _resolved_imports(file)
        forbidden = {
            m
            for m in imports
            if m.startswith((
                "narrativex_gpu_worker.adapters",
                "narrativex_gpu_worker.bootstrap",
            ))
        }
        assert not forbidden, f"{file.name} imports forbidden modules: {forbidden}"


def test_adapters_layer_does_not_import_bootstrap() -> None:
    adapters = SOURCE / "narrativex_gpu_worker" / "adapters"
    files = [f for f in adapters.rglob("*.py") if f.is_file() and f.stat().st_size > 20]
    assert len(files) > 0, "Adapters files must exist"
    for file in files:
        imports = _resolved_imports(file)
        forbidden = {m for m in imports if m.startswith("narrativex_gpu_worker.bootstrap")}
        assert not forbidden, f"{file.name} imports bootstrap: {forbidden}"


def test_executor_implementation_has_one_canonical_package() -> None:
    package = SOURCE / "narrativex_gpu_worker"
    assert not (package / "executors").exists()
    assert (package / "adapters" / "executors").is_dir()


def test_no_legacy_runtime_or_shim_symbols_used() -> None:
    active_files = [
        f
        for f in SOURCE.rglob("*.py")
        if f.stat().st_size > 20 and not f.name.endswith(".pyc") and "__pycache__" not in f.parts
    ]
    assert len(active_files) > 0
    combined_source = "\n".join(f.read_text(encoding="utf-8") for f in active_files)
    for forbidden in FORBIDDEN_LEGACY_SYMBOLS:
        pattern = rf"\b{re.escape(forbidden)}\b"
        assert not re.search(pattern, combined_source), (
            f"Forbidden legacy symbol {forbidden} found in source"
        )


def test_legacy_aliases_removed_from_bootstrap_and_appstate() -> None:
    from narrativex_gpu_worker.bootstrap import ApplicationComponents

    assert not hasattr(ApplicationComponents, "registry")

    from narrativex_gpu_worker.adapters.inbound.http.app import AppState

    assert not hasattr(AppState, "registry")
    assert not hasattr(AppState, "runtime")
