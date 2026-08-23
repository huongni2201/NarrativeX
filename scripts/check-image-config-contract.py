#!/usr/bin/env python3
"""Validate the production image provider/model/pricing contract across backend and worker."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
ENV = (ROOT / ".env.example").read_text(encoding="utf-8")
BACKEND_ENV = (ROOT / "app" / "backend-service" / ".env.example").read_text(encoding="utf-8")

REQUIRED_COMPOSE = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY: ${NARRATIVEX_IMAGE_PROVIDER_KEY",
    "NARRATIVEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL",
    "NARRATIVEX_IMAGE_PRICING_VERSION: ${NARRATIVEX_IMAGE_PRICING_VERSION",
    "NARRATIVEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE",
    "NARRATIVEX_IMAGE_UNIT_COST_DRAFT: ${NARRATIVEX_IMAGE_UNIT_COST_DRAFT",
    "NARRATIVEX_IMAGE_UNIT_COST_STANDARD: ${NARRATIVEX_IMAGE_UNIT_COST_STANDARD",
    "NARRATIVEX_IMAGE_UNIT_COST_HIGH: ${NARRATIVEX_IMAGE_UNIT_COST_HIGH",
    "VERTEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL",
    "VERTEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE",
)
REQUIRED_ENV = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY=vertex",
    "NARRATIVEX_IMAGE_MODEL=gemini-2.5-flash-image",
    "NARRATIVEX_IMAGE_PRICING_VERSION=gemini-2.5-flash-image-batch-2026-08-22",
    "NARRATIVEX_IMAGE_EXECUTION_MODE=batch",
    "NARRATIVEX_IMAGE_UNIT_COST_DRAFT=0.10",
    "NARRATIVEX_IMAGE_UNIT_COST_STANDARD=0.25",
    "NARRATIVEX_IMAGE_UNIT_COST_HIGH=0.40",
)

errors = [f"docker-compose.prod.yml: {value}" for value in REQUIRED_COMPOSE if value not in COMPOSE]
errors += [f".env.example: {value}" for value in REQUIRED_ENV if value not in ENV]
errors += [
    f"app/backend-service/.env.example: {value}"
    for value in REQUIRED_ENV
    if value not in BACKEND_ENV
]
if errors:
    raise SystemExit("Image config contract drift:\n- " + "\n- ".join(errors))

print("Image config contract passed.")
