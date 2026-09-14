from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_container_is_non_root_and_has_no_database_configuration() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "USER appuser" in dockerfile
    assert "DATABASE_URL" not in dockerfile
    assert "EXPOSE 8010" in dockerfile
    assert "/healthz" in dockerfile


def test_base_dependencies_exclude_gpu_and_database_stacks() -> None:
    project = (ROOT / "pyproject.toml").read_text(encoding="utf-8").lower()
    base = project.split("[project.optional-dependencies]", maxsplit=1)[0]
    for forbidden in ("asyncpg", "psycopg", "torch==", "whisperx==", "pillow=="):
        assert forbidden not in base
