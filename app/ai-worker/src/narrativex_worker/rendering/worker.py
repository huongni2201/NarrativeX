"""Local FFmpeg IMAGE_MOTION chapter render worker."""

import asyncio
import contextlib
import hashlib
import json
import logging
import uuid
from pathlib import Path

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.storage import MediaAssetConflictError, MediaStorage, S3MediaStorage
from narrativex_worker.rendering.ffmpeg import FfmpegError, render_image_motion
from narrativex_worker.rendering.image_motion import ImageMotionManifest, MotionBeat
from narrativex_worker.rendering.repository import (
    ClaimedRenderJob,
    RenderBeatAsset,
    RenderLeaseLostError,
    RenderRepository,
)
from narrativex_worker.rendering.validation import RenderValidationError, probe_mp4, validate_probe
from narrativex_worker.workspace import WorkerWorkspace, sha256_file


class RenderWorkerRunner:
    """Claim CPU_RENDER jobs, assemble deterministic MP4s, validate, and persist them durably."""

    def __init__(
        self,
        settings: WorkerSettings,
        concurrency_gate: asyncio.Semaphore,
        *,
        repository: RenderRepository | None = None,
        storage: MediaStorage | None = None,
        workspace: WorkerWorkspace | None = None,
    ) -> None:
        self.settings = settings
        self.enabled = settings.media_storage_mode == "r2"
        self.worker_id = f"{settings.worker_name}-render-{uuid.uuid4()}"
        self.repository = repository or RenderRepository(
            settings.database_url,
            settings.lease_seconds,
            pool_size=min(settings.worker_concurrency + 1, 8),
        )
        self.storage = storage
        self.workspace = workspace or WorkerWorkspace()
        self._concurrency_gate = concurrency_gate
        self._running = False
        self._tasks: set[asyncio.Task[None]] = set()
        self.logger = logging.getLogger("narrativex.render")

    def stop(self) -> None:
        self._running = False

    async def start(self, *, dry_run: bool = False) -> None:
        if not self.enabled:
            self.logger.info("Render worker disabled (MEDIA_STORAGE_MODE must be r2)")
            return
        if dry_run:
            self.logger.info("Render worker dry run completed")
            return
        if self.storage is None:
            self.storage = S3MediaStorage(self.settings)
        await self.repository.connect()
        self._running = True
        try:
            while self._running:
                self._tasks = {task for task in self._tasks if not task.done()}
                if len(self._tasks) >= self.settings.worker_concurrency:
                    await asyncio.wait(self._tasks, return_when=asyncio.FIRST_COMPLETED)
                    continue
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    if self._tasks:
                        await asyncio.wait(
                            self._tasks,
                            timeout=self.settings.poll_interval_seconds,
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                    else:
                        await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue
                task = asyncio.create_task(self._process(claimed))
                self._tasks.add(task)
        finally:
            for task in self._tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
            await self.repository.close()

    async def _process(self, claimed: ClaimedRenderJob) -> None:
        processing = asyncio.create_task(self._process_claimed(claimed))
        heartbeat = asyncio.create_task(self._heartbeat(claimed))
        try:
            done, _ = await asyncio.wait(
                {processing, heartbeat}, return_when=asyncio.FIRST_COMPLETED
            )
            if heartbeat in done:
                await heartbeat
                raise RenderLeaseLostError("Render heartbeat stopped unexpectedly")
            await processing
        except RenderLeaseLostError:
            self.logger.warning(
                "Render lease lost; cancelling job=%s worker=%s",
                claimed.generation_job_id,
                claimed.worker_id,
            )
            if not processing.done():
                processing.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await processing
        except asyncio.CancelledError:
            raise
        except (FileNotFoundError, OSError, TimeoutError) as exception:
            self.logger.warning(
                "Transient render infrastructure failure job=%s: %s",
                claimed.generation_job_id,
                exception,
            )
            await self.repository.mark_stalled(claimed, "RENDER_INFRASTRUCTURE_RETRY")
        except (FfmpegError, RenderValidationError, MediaAssetConflictError, ValueError) as exception:
            self.logger.error(
                "Permanent render failure job=%s: %s",
                claimed.generation_job_id,
                exception,
            )
            await self.repository.fail(claimed, "RENDER_INPUT_OR_FFMPEG_FAILED")
        except Exception:
            self.logger.exception("Unexpected render failure job=%s", claimed.generation_job_id)
            await self.repository.fail(claimed, "RENDER_WORKER_INTERNAL_ERROR")
        finally:
            for task in (processing, heartbeat):
                if not task.done():
                    task.cancel()
            for task in (processing, heartbeat):
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

    async def _process_claimed(self, claimed: ClaimedRenderJob) -> None:
        assert self.storage is not None
        async with self._concurrency_gate:
            resolution, render_format = _parse_operation_type(claimed.operation_type)
            if render_format != "mp4":
                raise ValueError(f"Unsupported render format: {render_format}")
            width, height = _dimensions(resolution, claimed.aspect_ratio)
            beat_assets = await self.repository.load_beats(claimed)
            if not beat_assets:
                raise ValueError("Render media plan has no READY image assets")
            audio = await self.repository.load_audio(claimed)
            if audio is None:
                raise ValueError(
                    "No generated narration asset matches the pinned chapter revision/source hash"
                )

            await self.repository.assert_lease(claimed)
            durations_ms = _normalize_durations(beat_assets, audio.duration_ms)
            fingerprint_payload = {
                "version": "image-motion-render-v1",
                "projectId": claimed.project_id,
                "chapterId": claimed.chapter_id,
                "chapterRowVersion": claimed.chapter_row_version,
                "sourceHash": claimed.source_hash,
                "mediaPlanId": str(claimed.media_plan_id),
                "mediaPlanRevision": claimed.media_plan_revision,
                "resolution": resolution,
                "format": render_format,
                "aspectRatio": claimed.aspect_ratio,
                "fps": 30,
                "audio": {
                    "storageKey": audio.storage_key,
                    "checksum": audio.checksum,
                    "durationMs": audio.duration_ms,
                },
                "beats": [
                    {
                        "visualBeatId": beat.visual_beat_id,
                        "storageKey": beat.storage_key,
                        "checksum": beat.checksum,
                        "durationMs": duration,
                        "cameraMovement": beat.camera_movement,
                    }
                    for beat, duration in zip(beat_assets, durations_ms, strict=True)
                ],
            }
            serialized = json.dumps(
                fingerprint_payload, sort_keys=True, separators=(",", ":")
            )
            render_fingerprint = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

            async with self.workspace.create_job_dir(claimed.job_id) as job_dir:
                image_paths = await self._download_images(beat_assets, job_dir)
                audio_path = job_dir / "narration.mp3"
                await self.storage.download_to_file(
                    audio.storage_key,
                    audio_path,
                    expected_size=audio.size_bytes,
                    expected_checksum=audio.checksum,
                    max_bytes=self.settings.media_max_audio_bytes,
                )
                motion_beats = tuple(
                    MotionBeat(
                        image_path=path,
                        duration_seconds=duration / 1000.0,
                        camera_movement=beat.camera_movement,
                    )
                    for beat, duration, path in zip(
                        beat_assets, durations_ms, image_paths, strict=True
                    )
                )
                output_path = job_dir / "chapter.mp4"
                manifest = ImageMotionManifest(
                    beats=motion_beats,
                    audio_path=audio_path,
                    output_path=output_path,
                    width=width,
                    height=height,
                    fps=30,
                )
                await self.repository.assert_lease(claimed)
                await render_image_motion(manifest, timeout_seconds=1800.0)
                probe = await probe_mp4(output_path)
                validate_probe(
                    probe,
                    width=width,
                    height=height,
                    expected_duration_seconds=audio.duration_ms / 1000.0,
                    tolerance_seconds=0.35,
                )
                checksum = await asyncio.to_thread(sha256_file, output_path)
                final_key = (
                    f"renders/project-{claimed.project_id}/chapter-{claimed.chapter_id}/"
                    f"{render_fingerprint}.mp4"
                )
                stored = await self.storage.put_file_immutable(
                    storage_key=final_key,
                    file_path=output_path,
                    checksum=checksum,
                    mime_type="video/mp4",
                    metadata={
                        "render-fingerprint": render_fingerprint,
                        "generation-job-id": str(claimed.generation_job_id),
                    },
                )
                await self.repository.assert_lease(claimed)
                await self.repository.complete(
                    claimed,
                    render_fingerprint=render_fingerprint,
                    manifest=fingerprint_payload,
                    media_asset=stored,
                    duration_ms=audio.duration_ms,
                    width=width,
                    height=height,
                    fps=30,
                )
                self.logger.info(
                    "Completed chapter render job=%s fingerprint=%s sizeBytes=%s",
                    claimed.generation_job_id,
                    render_fingerprint,
                    stored.size_bytes,
                )

    async def _download_images(
        self, beats: list[RenderBeatAsset], job_dir: Path
    ) -> list[Path]:
        assert self.storage is not None
        paths: list[Path] = []
        for index, beat in enumerate(beats):
            path = job_dir / f"beat-{index:04d}.img"
            await self.storage.download_to_file(
                beat.storage_key,
                path,
                expected_size=beat.size_bytes,
                expected_checksum=beat.checksum,
                max_bytes=self.settings.media_max_image_bytes,
            )
            paths.append(path)
        return paths

    async def _heartbeat(self, claimed: ClaimedRenderJob) -> None:
        interval = max(2.0, min(20.0, self.settings.lease_seconds / 3))
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(claimed):
                raise RenderLeaseLostError("Render heartbeat lease fence failed")


def _parse_operation_type(value: str) -> tuple[str, str]:
    parts = value.upper().split("_")
    if len(parts) != 4 or parts[0] != "CHAPTER" or parts[1] != "RENDER":
        raise ValueError("Render execution spec is missing from operation plan")
    resolution = parts[2].lower()
    render_format = parts[3].lower()
    if resolution not in {"720p", "1080p"}:
        raise ValueError(f"Unsupported render resolution: {resolution}")
    return resolution, render_format


def _dimensions(resolution: str, aspect_ratio: str) -> tuple[int, int]:
    short_edge = 1080 if resolution == "1080p" else 720
    mapping = {
        "16:9": (round(short_edge * 16 / 9), short_edge),
        "9:16": (short_edge, round(short_edge * 16 / 9)),
        "1:1": (short_edge, short_edge),
        "4:3": (round(short_edge * 4 / 3), short_edge),
        "3:4": (short_edge, round(short_edge * 4 / 3)),
    }
    width, height = mapping.get(aspect_ratio, mapping["16:9"])
    # H.264/yuv420p requires even dimensions.
    return width - (width % 2), height - (height % 2)


def _normalize_durations(beats: list[RenderBeatAsset], audio_duration_ms: int) -> list[int]:
    if audio_duration_ms <= 0:
        raise ValueError("Narration duration must be positive")
    raw = [beat.duration_ms or 0 for beat in beats]
    total = sum(value for value in raw if value > 0)
    if total <= 0:
        base = audio_duration_ms // len(beats)
        durations = [max(1, base) for _ in beats]
    else:
        durations = [max(1, round((max(1, value) / total) * audio_duration_ms)) for value in raw]
    delta = audio_duration_ms - sum(durations)
    durations[-1] = max(1, durations[-1] + delta)
    return durations
