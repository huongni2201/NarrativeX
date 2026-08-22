import tomllib
from pathlib import Path

DOCKERFILE = Path(__file__).parents[1] / "Dockerfile"
PYPROJECT = Path(__file__).parents[1] / "pyproject.toml"


def test_worker_image_provides_writable_model_cache_home() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "ENV HOME=/home/appuser" in dockerfile
    assert "ENV HF_HOME=/home/appuser/.cache/huggingface" in dockerfile
    assert "mkdir -p /home/appuser/.cache/huggingface /home/appuser/.config" in dockerfile
    assert "chown -R appuser:appgroup /home/appuser" in dockerfile


def test_worker_dependencies_include_torch_for_vieneu_voice_enrollment() -> None:
    project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    dependencies = project["project"]["dependencies"]

    assert any(dependency.lower().startswith("torch>=") for dependency in dependencies)
    assert any(dependency.lower().startswith("torchaudio>=") for dependency in dependencies)
