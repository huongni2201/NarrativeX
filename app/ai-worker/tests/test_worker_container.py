import tomllib
from pathlib import Path

DOCKERFILE = Path(__file__).parents[1] / "Dockerfile"
PYPROJECT = Path(__file__).parents[1] / "pyproject.toml"
COMPOSE = PYPROJECT.parents[2] / "docker-compose.yml"


def test_worker_image_provides_writable_model_cache_home() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "ENV HOME=/home/appuser" in dockerfile
    assert "ENV HF_HOME=/home/appuser/.cache/huggingface" in dockerfile
    assert "mkdir -p /home/appuser/.cache/huggingface /home/appuser/.config" in dockerfile
    assert "chown -R appuser:appgroup /home/appuser" in dockerfile


def test_worker_dependencies_are_split_by_role() -> None:
    project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    dependencies = project["project"]["dependencies"]
    extras = project["project"]["optional-dependencies"]

    assert not any(
        dependency.lower().startswith(("torch", "torchaudio", "vieneu"))
        for dependency in dependencies
    )
    assert any(dependency.lower().startswith("pillow==") for dependency in extras["image"])
    assert any(dependency.lower().startswith("vieneu==") for dependency in extras["narration"])
    assert any(
        dependency.lower().startswith(("torch==", "torchaudio=="))
        for dependency in extras["narration"]
    )
    assert "render" not in extras


def test_dev_dependencies_do_not_install_tts_runtime_stack() -> None:
    project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    dev_dependencies = project["project"]["optional-dependencies"]["dev"]

    assert not any(
        dependency.lower().startswith(("vieneu==", "torch==", "torchaudio=="))
        for dependency in dev_dependencies
    )


def test_dockerfile_has_only_active_role_targets() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "FROM base AS worker-core" in dockerfile
    assert "FROM media-base AS worker-image" in dockerfile
    assert "FROM media-base AS worker-narration" in dockerfile
    assert "worker-render" not in dockerfile
    assert dockerfile.count("HEALTHCHECK") == 1
    assert 'pip install ".[image]"' in dockerfile
    assert 'pip install ".[narration]"' in dockerfile
    assert 'pip install ".[render]"' not in dockerfile


def test_compose_selects_only_active_worker_targets() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")

    assert "target: worker-image" in compose
    assert "target: worker-narration" in compose
    assert "worker-render" not in compose


def _service(compose_lines: list[str], service_name: str) -> str:
    service_start = compose_lines.index(f"  {service_name}:") + 1
    service_lines: list[str] = []
    for line in compose_lines[service_start:]:
        if line.startswith("  ") and not line.startswith("    "):
            break
        service_lines.append(line)
    return "\n".join(service_lines)


def test_project_media_services_share_one_local_root() -> None:
    compose_lines = COMPOSE.read_text(encoding="utf-8").splitlines()
    backend_service = _service(compose_lines, "backend")
    ai_service = _service(compose_lines, "ai-worker")
    narration_service = _service(compose_lines, "narration-worker")

    for service in (backend_service, ai_service, narration_service):
        assert "PROJECT_MEDIA_LOCAL_DIR: /data/narrativex/project-media" in service
        assert "target: /data/narrativex/project-media" in service
        assert "source: ${PROJECT_MEDIA_HOST_DIR:?Set PROJECT_MEDIA_HOST_DIR in .env}" in service
        assert "MEDIA_STORAGE_MODE" not in service


def test_narration_worker_reads_voice_references_from_r2_without_static_host_mount() -> None:
    compose_lines = COMPOSE.read_text(encoding="utf-8").splitlines()
    narration_service = _service(compose_lines, "narration-worker")

    assert "<<: *worker-database-environment" in narration_service
    assert "WORKER_ROLES: narration" in narration_service
    assert "TTS_PROVIDER_MODE: vieneu" in narration_service
    assert "R2_ACCOUNT_ID:" in narration_service
    assert "R2_ACCESS_KEY_ID:" in narration_service
    assert "R2_SECRET_ACCESS_KEY:" in narration_service
    assert "VIENEU_REFERENCE_AUDIO_PATH:" not in narration_service
    assert "VIENEU_REFERENCE_AUDIO_FILE" not in narration_service
    assert "target: /run/narrativex/voices/reference.wav" not in narration_service
