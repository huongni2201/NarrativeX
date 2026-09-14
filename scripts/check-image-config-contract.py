#!/usr/bin/env python3
"""Validate the production local image provider/model execution contract."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
ENV = (ROOT / ".env.example").read_text(encoding="utf-8")

REQUIRED_COMPOSE = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY: ${NARRATIVEX_IMAGE_PROVIDER_KEY:-realvisxl}",
    "NARRATIVEX_IMAGE_MODEL: ${REALVISXL_CHECKPOINT:?Set REALVISXL_CHECKPOINT in .env}",
    "NARRATIVEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE:-batch}",
    "IMAGE_PROVIDER_MODE: realvisxl",
    "IMAGE_BATCH_MAX_ITEMS: 1",
    "REALVISXL_BASE_URL: ${REALVISXL_BASE_URL:-http://host.docker.internal:8188}",
)
REQUIRED_ENV = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY=realvisxl",
    "NARRATIVEX_IMAGE_EXECUTION_MODE=batch",
    "REALVISXL_BASE_URL=http://host.docker.internal:8188",
    "REALVISXL_CHECKPOINT=",
    "IMAGE_BATCH_MAX_ITEMS=1",
)
FORBIDDEN = (
    "NARRATIVEX_IMAGE_PRICING_VERSION",
    "NARRATIVEX_IMAGE_UNIT_COST",
    "VERTEX_IMAGE_MODEL:",
    "VERTEX_IMAGE_BATCH_GCS_BUCKET:",
    "GOOGLE_APPLICATION_CREDENTIALS:",
)

errors = [f"docker-compose.yml: missing {value}" for value in REQUIRED_COMPOSE if value not in COMPOSE]
errors += [f".env.example: missing {value}" for value in REQUIRED_ENV if value not in ENV]
for value in FORBIDDEN:
    if value in COMPOSE:
        errors.append(f"docker-compose.yml: obsolete image config {value}")
if errors:
    raise SystemExit("Image config contract drift:\n- " + "\n- ".join(errors))

print("Image config contract passed (local RealVisXL; image billing disabled).")
