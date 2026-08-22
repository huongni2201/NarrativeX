from pathlib import Path


DOCKERFILE = Path(__file__).parents[1] / "Dockerfile"


def test_worker_image_provides_writable_model_cache_home() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "ENV HOME=/home/appuser" in dockerfile
    assert "ENV HF_HOME=/home/appuser/.cache/huggingface" in dockerfile
    assert "mkdir -p /home/appuser/.cache/huggingface /home/appuser/.config" in dockerfile
    assert "chown -R appuser:appgroup /home/appuser" in dockerfile
