from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "narrativex_worker"
FORBIDDEN = (
    "from narrativex_worker.image_generation_repository.implementation import "
    "ImageGenerationRepository"
)


def test_image_generation_repository_consumers_use_public_facade() -> None:
    offenders: list[str] = []
    for path in ROOT.rglob("*.py"):
        if path.name == "__init__.py" and path.parent.name == "image_generation_repository":
            continue
        if FORBIDDEN in path.read_text(encoding="utf-8"):
            offenders.append(str(path.relative_to(ROOT)))

    assert offenders == [], (
        "Image generation consumers must import ImageGenerationRepository from the public "
        "narrativex_worker.image_generation_repository facade so the paid-operation recovery "
        f"invariants cannot be bypassed. Direct implementation imports: {offenders}"
    )
