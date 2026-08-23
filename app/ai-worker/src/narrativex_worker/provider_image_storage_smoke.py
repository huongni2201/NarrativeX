"""Manual smoke for the paid Vertex image -> R2 -> Google Drive production path."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.storage import S3MediaStorage
from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest
from narrativex_worker.providers.vertex_image_batch import VertexBatchImageProvider
from narrativex_worker.rendering.final_storage import GoogleDriveFinalVideoStorage
from narrativex_worker.schema import ImageAspectRatio, ImageQualityTier, ProviderOperationStatus


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for the real image/storage smoke check")
    return value


def _sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


async def _create_drive_smoke_video(path: Path) -> None:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=32x32:d=0.25:r=10",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-metadata",
        "creation_time=1970-01-01T00:00:00Z",
        "-movflags",
        "+faststart",
        str(path),
    ]
    await asyncio.to_thread(subprocess.run, command, check=True, capture_output=True)


async def run_smoke() -> None:
    settings = WorkerSettings(
        worker_env="provider-image-smoke",
        image_provider_mode="vertex",
        vertex_project_id=_required_env("VERTEX_PROJECT_ID"),
        vertex_image_model=os.getenv("VERTEX_IMAGE_MODEL", "gemini-2.5-flash-image"),
        vertex_image_location=os.getenv("VERTEX_IMAGE_LOCATION", "global"),
        vertex_image_batch_location=os.getenv("VERTEX_IMAGE_BATCH_LOCATION", "global"),
        vertex_image_batch_gcs_bucket=_required_env("VERTEX_IMAGE_BATCH_GCS_BUCKET"),
        vertex_image_batch_gcs_prefix=os.getenv(
            "VERTEX_IMAGE_BATCH_GCS_PREFIX", "narrativex/provider-smoke"
        ),
        vertex_image_batch_poll_seconds=5.0,
        media_storage_mode="r2",
        r2_account_id=_required_env("R2_ACCOUNT_ID"),
        r2_access_key_id=_required_env("R2_ACCESS_KEY_ID"),
        r2_secret_access_key=_required_env("R2_SECRET_ACCESS_KEY"),
        r2_bucket=_required_env("R2_BUCKET"),
        r2_endpoint=os.getenv("R2_ENDPOINT") or None,
    )

    prompt = "A simple black ceramic cup on a plain white studio background, product photo."
    request_fingerprint = _sha256_bytes(prompt.encode("utf-8"))
    item = ImageBatchItem(
        "provider-smoke-1",
        ImageGenerationRequest(
            request_fingerprint=request_fingerprint,
            prompt=prompt,
            negative_prompt="text, watermark, logo",
            aspect_ratio=ImageAspectRatio.RATIO_16_9,
            quality_tier=ImageQualityTier.STANDARD,
            provider_key="vertex",
            model_key=settings.vertex_image_model,
            location=settings.vertex_image_batch_location,
            max_output_bytes=settings.image_max_output_bytes,
        ),
    )

    provider = VertexBatchImageProvider(settings)
    try:
        operation = await provider.submit_batch((item,))
        deadline = time.monotonic() + float(os.getenv("PROVIDER_SMOKE_TIMEOUT_SECONDS", "900"))
        while operation.status not in {
            ProviderOperationStatus.COMPLETED,
            ProviderOperationStatus.FAILED,
        }:
            if time.monotonic() >= deadline:
                raise RuntimeError("Vertex image smoke timed out waiting for batch completion")
            if not operation.operation_id:
                raise RuntimeError("Vertex image smoke has no durable provider operation id")
            await asyncio.sleep(settings.vertex_image_batch_poll_seconds)
            operation = await provider.reconcile_batch(operation)

        if operation.status is ProviderOperationStatus.FAILED:
            raise RuntimeError(
                f"Vertex image smoke failed: {operation.error_code or 'UNKNOWN_PROVIDER_ERROR'}"
            )
        if len(operation.results) != 1 or operation.results[0].result is None:
            raise RuntimeError("Vertex image smoke returned no materialized image")

        image = operation.results[0].result
        r2 = S3MediaStorage(settings)
        storage_key = f"provider-smoke/images/{image.result_fingerprint}.{image.mime_type.split('/')[-1]}"
        stored = await r2.put_immutable(
            storage_key=storage_key,
            content=image.content,
            checksum=image.result_fingerprint,
            mime_type=image.mime_type,
            metadata={"source": "real-provider-smoke"},
        )
        confirmed = await r2.find(storage_key)
        if confirmed is None or confirmed.checksum != image.result_fingerprint:
            raise RuntimeError("R2 smoke verification failed")

        with tempfile.TemporaryDirectory(prefix="narrativex-provider-smoke-") as temp_dir:
            video_path = Path(temp_dir) / "drive-smoke.mp4"
            await _create_drive_smoke_video(video_path)
            video_bytes = await asyncio.to_thread(video_path.read_bytes)
            video_checksum = _sha256_bytes(video_bytes)
            drive = GoogleDriveFinalVideoStorage.from_env()
            drive_asset = await drive.put_immutable(
                file_path=video_path,
                render_fingerprint=f"provider-smoke-drive-v1-{video_checksum[:24]}",
                checksum=video_checksum,
                generation_job_id=0,
            )

        print(
            json.dumps(
                {
                    "status": "ok",
                    "vertexOperationId": operation.operation_id,
                    "imageModel": settings.vertex_image_model,
                    "imageBytes": len(image.content),
                    "r2StorageKey": stored.storage_key,
                    "driveFileId": drive_asset.external_file_id,
                    "driveSizeBytes": drive_asset.size_bytes,
                },
                separators=(",", ":"),
            )
        )
    finally:
        await provider.aclose()


def main() -> None:
    asyncio.run(run_smoke())


if __name__ == "__main__":
    main()
