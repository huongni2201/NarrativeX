#!/usr/bin/env python3
"""Validate the production image provider/model contract across backend and worker."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
ENV = (ROOT / ".env.example").read_text(encoding="utf-8")

REQUIRED_COMPOSE = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY: ${NARRATIVEX_IMAGE_PROVIDER_KEY}",
    "NARRATIVEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL}",
    "NARRATIVEX_IMAGE_PRICING_VERSION: ${NARRATIVEX_IMAGE_PRICING_VERSION}",
    "NARRATIVEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE}",
    "VERTEX_IMAGE_MODEL: ${NARRATIVEX_IMAGE_MODEL}",
    "VERTEX_IMAGE_EXECUTION_MODE: ${NARRATIVEX_IMAGE_EXECUTION_MODE}",
)
REQUIRED_ENV = (
    "NARRATIVEX_IMAGE_PROVIDER_KEY=vertex",
    "NARRATIVEX_IMAGE_MODEL=gemini-2.5-flash-image",
    "NARRATIVEX_IMAGE_PRICING_VERSION=gemini-2.5-flash-image-batch-2026-08-22",
    "NARRATIVEX_IMAGE_EXECUTION_MODE=batch",
)

errors = [value for value in REQUIRED_COMPOSE if value not in COMPOSE]
errors += [value for value in REQUIRED_ENV if value not in ENV]
if errors:
    raise SystemExit("Image config contract drift:\n- " + "\n- ".join(errors))

print("Image config contract passed.")
