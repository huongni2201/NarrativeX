"""Local FFmpeg IMAGE_MOTION chapter render worker."""

import asyncio
import contextlib
import hashlib
import json
import logging
import uuid
from pathlib import Path

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.storage import (
    MediaAssetConflictError,
    MediaStorage,
    S3MediaStorage,
)
from narrativex_worker.rendering.advisory_lock import render_fingerprint_lock
from narrativex_worker.rendering.ffmpeg import FfmpegError, render_image_motion
from narrativex_worker.rendering.final_storage import (
    FinalVideoStorageError,
    GoogleDriveFinalVideoStorage,
)
from narrativex_worker.rendering.image_motion import ImageMotionManifest, MotionBeat
from narrativex_worker.rendering.repository import (
    ClaimedRenderJob,
    RenderBeatAsset,
    RenderLeaseLostError,
    RenderRepository,
)
from narrativex_worker.rendering.subtitles import (
    build_subtitle_track,
    load_subtitle_source,
    write_ass_subtitles,
)
from narrativex_worker.rendering.validation import (
    RenderValidationError,
    probe_mp4,
    validate_probe,
)
from narrativex_worker.workspace import WorkerWorkspace, sha256_file


class RenderWorkerRunner:
    """Claim render jobs, build MP4s, and persist final videos to Google Drive."""

    def __init__(
        self,
        settings: WorkerSettings,
        concurrency_gate: asyncio.Semaphore,
        *,
        repository: RenderRepository | None = None,
        storage: MediaStorage | None = None,
        final_storage: GoogleDriveFinalVideoStorage | None = None,
        workspace: WorkerWorkspace | None = None,
    ) -> None:
        self.settings = settings
        # Render inputs (images/audio) remain in R2. Only the final MP4 uses Drive.
        self.enabled = settings.media_storage_mode == "r2"
        self.worker_id = f"{settings.worker_name}-render-{uuid.uuid4()}"
        self.repository = repository or RenderRepository(
            settings.database_url,
            settings.lease_seconds,
            pool_size=min(settings.worker_concurrency + 1, 8),
        )
        self.storage = storage
        self.final_storage = final_storage
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
        if self.final_storage is None:
            self.final_storage = GoogleDriveFinalVideoStorage.from_env()
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
        except FinalVideoStorageError as exception:
            self.logger.warning(
                "Final-video storage failure job=%s: %s",
                claimed.generation_job_id,
                exception,
            )
            await self.repository.mark_stalled(claimed, "GOOGLE_DRIVE_UPLOAD_RETRY")
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
        assert self.final_storage is not None
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
            subtitle_source = await load_subtitle_source(
                self.settings.database_url,
                project_id=claimed.project_id,
                chapter_id=claimed.chapter_id,
                chapter_row_version=claimed.chapter_row_version,
                source_hash=claimed.source_hash,
                narration_request_id=claimed.narration_request_id,
                narration_asset_id=claimed.narration_asset_id,
                narration_alignment_id=claimed.narration_alignment_id,
            )
            subtitle_track = build_subtitle_track(
                subtitle_source.source_text,
                subtitle_source.spans,
                audio.duration_ms,
                alignment_version=subtitle_source.alignment_version,
            )

            await self.repository.assert_lease(claimed)
            durations_ms = _normalize_durations(beat_assets, audio.duration_ms)
            fingerprint_payload = {
                "version": "image-motion-render-v5-admission-snapshot-drive-lock",
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
                "narration": {
                    "requestId": (
                        str(claimed.narration_request_id)
                        if claimed.narration_request_id is not None
                        else None
                    ),
                    "assetId": (
                        str(claimed.narration_asset_id)
                        if claimed.narration_asset_id is not None
                        else None
                    ),
                    "alignmentId": (
                        str(claimed.narration_alignment_id)
                        if claimed.narration_alignment_id is not None
                        else None
                    ),
                },
                "audio": {
                    "storageKey": audio.storage_key,
                    "checksum": audio.checksum,
                    "durationMs": audio.duration_ms,
                },
                "subtitles": {
                    "mode": "burned-ass",
                    "timingSource": subtitle_track.timing_source,
                    "fingerprint": subtitle_track.fingerprint,
                    "cueCount": len(subtitle_track.cues),
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
                subtitle_path = write_ass_subtitles(
                    subtitle_track,
                    job_dir / "subtitles.ass",
                    width=width,
                    height=height,
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
                    subtitle_path=subtitle_path,
                )
                await self.repository.assert_lease(claimed)
                await render_image_motion(manifest, timeout_seconds=1800.0)
                probe = await probe_mp4(output_path)
                validate_probe(
                    probe,
                    width=width,
                    height=height,
                    expected_duration_seconds=audio.duration_ms / 1000.0,
                    tolerance_seconds=max(0.35, len(beat_assets) / 30.0 + 0.1),
                )
                checksum = await asyncio.to_thread(sha256_file, output_path)
                async with render_fingerprint_lock(
                    self.settings.database_url, render_fingerprint
                ):
                    await self.repository.assert_lease(claimed)
                    stored = await self.final_storage.put_immutable(
                        file_path=output_path,
                        render_fingerprint=render_fingerprint,
                        checksum=checksum,
                        generation_job_id=claimed.generation_job_id,
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
                    "Completed chapter render job=%s fingerprint=%s driveFileId=%s sizeBytes=%s subtitleCues=%s",
                    claimed.generation_job_id,
                    render_fingerprint,
                    stored.external_file_id,
                    stored.size_bytes,
                    len(subtitle_track.cues),
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
    return width - (width % 2), height - (height % 2)


def _normalize_durations(beats: list[RenderBeatAsset], audio_duration_ms: int) -> list[int]:
    if audio_duration_ms <= 0:
        raise ValueError("Narration duration must be positive")
    if not beats:
        raise ValueError("Render requires at least one beat")
    if audio_duration_ms < len(beats):
        raise ValueError("Narration is too short for the number of render beats")

    weights = [max(1, beat.duration_ms or 0) for beat in beats]
    total_weight = sum(weights)
    boundaries = [0]
    cumulative = 0
    for weight in weights[:-1]:
        cumulative += weight
        boundaries.append(round(audio_duration_ms * cumulative / total_weight))
    boundaries.append(audio_duration_ms)

    durations = [
        boundaries[index + 1] - boundaries[index] for index in range(len(beats))
    ]
    if any(duration <= 0 for duration in durations):
        # This is only possible with extremely short audio; fail instead of drifting duration.
        raise ValueError("Narration duration cannot be distributed across render beats")
    return durations
