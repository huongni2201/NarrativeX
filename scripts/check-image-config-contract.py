#!/usr/bin/env python3
"""Validate the production local image provider/model execution contract."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
ENV = (ROOT / ".env.example").read_text(encoding="utf-8")

REQUIRED_COMPOSE = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY: ${NARRATIVEX_IMAGE_PROVIDER_KEY:-realvisxl}",
    "NARRATIVEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL:-realvisxl}",
    "NARRATIVEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE:-batch}",
    "GENERATION_SERVICE_COMFYUI_BASE_URL: ${GENERATION_SERVICE_COMFYUI_BASE_URL:-http://host.docker.internal:8188}",
)
REQUIRED_ENV = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY=realvisxl",
    "NARRATIVEX_IMAGE_MODEL=realvisxl",
    "NARRATIVEX_IMAGE_EXECUTION_MODE=batch",
    "GENERATION_SERVICE_COMFYUI_BASE_URL=http://host.docker.internal:8188",
)
FORBIDDEN = (
    "NARRATIVEX_IMAGE_PRICING_VERSION",
    "NARRATIVEX_IMAGE_UNIT_COST",
    "VERTEX_IMAGE_MODEL:",
    "VERTEX_IMAGE_BATCH_GCS_BUCKET:",
    "GOOGLE_APPLICATION_CREDENTIALS:",
    "IMAGE_PROVIDER_MODE:",
    "REALVISXL_BASE_URL:",
    "REALVISXL_CHECKPOINT",
    "IMAGE_BATCH_MAX_ITEMS:",
)

errors = [f"docker-compose.yml: missing {value}" for value in REQUIRED_COMPOSE if value not in COMPOSE]
errors += [f".env.example: missing {value}" for value in REQUIRED_ENV if value not in ENV]
for value in FORBIDDEN:
    if value in COMPOSE:
        errors.append(f"docker-compose.yml: obsolete image config {value}")
    if value in ENV:
        errors.append(f".env.example: obsolete image config {value}")
if errors:
    raise SystemExit("Image config contract drift:\n- " + "\n- ".join(errors))

print("Image config contract passed (generation-service ComfyUI/RealVisXL; image billing disabled).")
