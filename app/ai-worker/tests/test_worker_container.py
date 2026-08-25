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
    assert any(dependency.lower().startswith("ffmpeg-python==") for dependency in extras["render"])


def test_dockerfile_has_role_targets_with_healthcheck_inherited_by_each_target() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "FROM base AS worker-core" in dockerfile
    assert "FROM media-base AS worker-image" in dockerfile
    assert "FROM media-base AS worker-narration" in dockerfile
    assert "FROM media-base AS worker-render" in dockerfile
    assert dockerfile.count("HEALTHCHECK") == 1
    assert 'pip install ".[image]"' in dockerfile
    assert 'pip install ".[narration]"' in dockerfile
    assert 'pip install ".[render]"' in dockerfile


def test_compose_selects_the_role_appropriate_targets() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")

    assert "context: ./app/ai-worker, dockerfile: Dockerfile, target: worker-image" in compose
    assert "context: ./app/ai-worker, dockerfile: Dockerfile, target: worker-narration" in compose
    assert "context: ./app/ai-worker, dockerfile: Dockerfile, target: worker-render" in compose
