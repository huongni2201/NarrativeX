#!/usr/bin/env python3
"""Validate the production image provider/model execution contract across backend and worker."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
ENV = (ROOT / ".env.example").read_text(encoding="utf-8")

REQUIRED_COMPOSE = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY: ${NARRATIVEX_IMAGE_PROVIDER_KEY",
    "NARRATIVEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL",
    "NARRATIVEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE",
    "VERTEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL",
    "VERTEX_IMAGE_BATCH_GCS_BUCKET: ${VERTEX_IMAGE_BATCH_GCS_BUCKET",
)
REQUIRED_ENV = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY=vertex",
    "NARRATIVEX_IMAGE_MODEL=gemini-2.5-flash-image",
    "NARRATIVEX_IMAGE_EXECUTION_MODE=batch",
)
FORBIDDEN = (
    "NARRATIVEX_IMAGE_PRICING_VERSION",
    "NARRATIVEX_IMAGE_UNIT_COST",
)

errors = [f"docker-compose.yml: missing {value}" for value in REQUIRED_COMPOSE if value not in COMPOSE]
errors += [f".env.example: missing {value}" for value in REQUIRED_ENV if value not in ENV]
for value in FORBIDDEN:
    if value in COMPOSE:
        errors.append(f"docker-compose.yml: obsolete billing config {value}")
    if value in ENV:
        errors.append(f".env.example: obsolete billing config {value}")
if errors:
    raise SystemExit("Image config contract drift:\n- " + "\n- ".join(errors))

print("Image config contract passed (provider/model/execution only; image billing disabled).")
