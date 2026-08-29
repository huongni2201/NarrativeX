"""Synchronous R2 bootstrap for a configured built-in VieNeu voice profile."""

from __future__ import annotations

import hashlib
from pathlib import Path

import boto3  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings

R2_REFERENCE_PREFIX = "r2://"


def materialize_r2_reference(settings: WorkerSettings, uri: str, destination: Path) -> Path:
    if not uri.startswith(R2_REFERENCE_PREFIX):
        raise ValueError("VieNeu R2 reference URI must start with r2://")
    storage_key = uri[len(R2_REFERENCE_PREFIX) :].lstrip("/")
    if not storage_key:
        raise ValueError("VieNeu R2 reference URI must include an object key")

    settings.require_voice_reference_r2()
    endpoint = settings.resolved_r2_endpoint
    assert endpoint is not None
    assert settings.r2_access_key_id is not None
    assert settings.r2_secret_access_key is not None

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name="auto",
        aws_access_key_id=settings.r2_access_key_id.get_secret_value(),
        aws_secret_access_key=settings.r2_secret_access_key.get_secret_value(),
    )
    response = client.get_object(Bucket=settings.r2_bucket, Key=storage_key)
    body = response["Body"]
    metadata = {str(key): str(value) for key, value in response.get("Metadata", {}).items()}
    expected_checksum = metadata.get("sha256")
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    try:
        with destination.open("wb") as output:
            while chunk := body.read(1024 * 1024):
                digest.update(chunk)
                output.write(chunk)
    finally:
        body.close()

    if expected_checksum and digest.hexdigest() != expected_checksum.lower():
        destination.unlink(missing_ok=True)
        raise RuntimeError("VieNeu R2 bootstrap reference checksum mismatch")
    return destination
