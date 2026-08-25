"""Segmented long-form project production render worker."""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import time
import uuid
from dataclasses import replace
from pathlib import Path

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.storage import (
    LocalMediaStorage,
    MediaAssetConflictError,
    MediaStorage,
    S3MediaStorage,
)
from narrativex_worker.observability import PipelineContext, PipelineMetrics
from narrativex_worker.project_rendering.ffmpeg import (
    ProjectFfmpegError,
    concat_audio_parts,
    concat_video_segments,
    mux_master_audio,
)
from narrativex_worker.project_rendering.repository import (
    ClaimedProjectRenderJob,
    ProjectRenderBeatAsset,
    ProjectRenderChapterAudio,
    ProjectRenderLeaseLostError,
    ProjectRenderRepository,
)
from narrativex_worker.rendering.advisory_lock import render_fingerprint_lock
from narrativex_worker.rendering.ffmpeg import FfmpegError, render_image_motion
from narrativex_worker.rendering.final_storage import (
    FinalVideoStorage,
    FinalVideoStorageError,
    GoogleDriveFinalVideoStorage,
)
from narrativex_worker.rendering.image_motion import ImageMotionManifest, MotionBeat
from narrativex_worker.rendering.local_final_storage import LocalFinalVideoStorage
from narrativex_worker.rendering.profile import RenderProfile
from narrativex_worker.rendering.validation import RenderValidationError, probe_mp4, validate_probe
from narrativex_worker.workspace import WorkerWorkspace, sha256_file

MAX_SEGMENT_DURATION_MS = 5 * 60 * 1000
PREFERRED_SEGMENT_DURATION_MS = 4 * 60 * 1000


class ProjectRenderWorkerRunner:
    """Render immutable project timelines in bounded FFmpeg-sized segments."""

    def __init__(
        self,
        settings: WorkerSettings,
        concurrency_gate: asyncio.Semaphore,
        *,
        repository: ProjectRenderRepository | None = None,
        storage: MediaStorage | None = None,
        final_storage: FinalVideoStorage | None = None,
        workspace: WorkerWorkspace | None = None,
    ) -> None:
        self.settings = settings
        self.enabled = settings.media_storage_mode in {"r2", "local"}
        self.worker_id = f"{settings.worker_name}-project-render-{uuid.uuid4()}"
        self.repository = repository or ProjectRenderRepository(
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
        self.logger = logging.getLogger("narrativex.project-render")
        self.metrics = PipelineMetrics(self.logger)

    def stop(self) -> None:
        self._running = False

    async def start(self, *, dry_run: bool = False) -> None:
        if not self.enabled:
            self.logger.info(
                "Project render worker disabled (MEDIA_STORAGE_MODE must be r2 or local)"
            )
            return
        if dry_run:
            self.logger.info("Project render worker dry run completed")
            return
        if self.storage is None:
            self.storage = (
                LocalMediaStorage(self.settings.media_local_dir)
                if self.settings.media_storage_mode == "local"
                else S3MediaStorage(self.settings)
            )
        if self.final_storage is None:
            self.final_storage = (
                LocalFinalVideoStorage(self.settings.final_video_local_dir)
                if self.settings.final_video_storage_mode == "local"
                else GoogleDriveFinalVideoStorage.from_env()
            )
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

    async def _process(self, claimed: ClaimedProjectRenderJob) -> None:
        started_at = time.monotonic()
        context = PipelineContext(job_id=claimed.job_id, project_id=claimed.project_id)
        processing = asyncio.create_task(self._process_claimed(claimed))
        heartbeat = asyncio.create_task(self._heartbeat(claimed))
        try:
            done, _ = await asyncio.wait(
                {processing, heartbeat}, return_when=asyncio.FIRST_COMPLETED
            )
            if heartbeat in done:
                await heartbeat
                raise ProjectRenderLeaseLostError("Project render heartbeat stopped unexpectedly")
            await processing
        except ProjectRenderLeaseLostError:
            self.logger.warning(
                "Project render lease lost job=%s worker=%s",
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
                "Project final-video storage failure job=%s: %s",
                claimed.generation_job_id,
                exception,
            )
            await self.repository.mark_stalled(claimed, "PROJECT_FINAL_STORAGE_RETRY")
        except (FileNotFoundError, OSError, TimeoutError) as exception:
            self.logger.warning(
                "Project render infrastructure failure job=%s: %s",
                claimed.generation_job_id,
                exception,
            )
            await self.repository.mark_stalled(claimed, "PROJECT_RENDER_INFRASTRUCTURE_RETRY")
        except (
            FfmpegError,
            ProjectFfmpegError,
            RenderValidationError,
            MediaAssetConflictError,
            ValueError,
        ) as exception:
            self.logger.error(
                "Permanent project render failure job=%s: %s",
                claimed.generation_job_id,
                exception,
            )
            await self.repository.fail(claimed, "PROJECT_RENDER_INPUT_OR_FFMPEG_FAILED")
        except Exception:
            self.logger.exception(
                "Unexpected project render failure job=%s", claimed.generation_job_id
            )
            await self.repository.fail(claimed, "PROJECT_RENDER_WORKER_INTERNAL_ERROR")
        finally:
            self.metrics.duration("generation_job_duration", started_at, context)
            for task in (processing, heartbeat):
                if not task.done():
                    task.cancel()
            for task in (processing, heartbeat):
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

    async def _process_claimed(self, claimed: ClaimedProjectRenderJob) -> None:
        assert self.storage is not None
        assert self.final_storage is not None
        async with self._concurrency_gate:
            resolution, render_format = _parse_operation_type(claimed.operation_type)
            if render_format != "mp4":
                raise ValueError(f"Unsupported project render format: {render_format}")
            width, height = _dimensions(resolution, claimed.aspect_ratio)
            profile = await _load_project_render_profile(
                self.settings.database_url, claimed.generation_job_id
            )
            chapters = await self.repository.load_chapters(claimed)
            beats = await self.repository.load_beats(claimed)
            _validate_snapshot(chapters, beats, claimed.total_duration_ms)
            segments = split_render_segments(beats)
            render_fingerprint = _render_fingerprint(
                claimed, chapters, beats, profile, resolution, render_format
            )
            await self.repository.update_progress(
                claimed, progress=8, current_step="RENDER_PROJECT_PREPARING"
            )

            async with self.workspace.create_job_dir(claimed.job_id) as job_dir:
                image_paths = await self._download_images(beats, job_dir)
                beat_path_by_id = {
                    beat.visual_beat_id: path for beat, path in zip(beats, image_paths, strict=True)
                }
                await self.repository.update_progress(
                    claimed, progress=10, current_step="RENDER_PROJECT_IMAGES_READY"
                )

                segment_paths: list[Path] = []
                for index, segment in enumerate(segments):
                    await self.repository.assert_lease(claimed)
                    segment_durations = _frame_quantized_duration_seconds(segment, profile.fps)
                    output_path = job_dir / f"segment-{index:04d}.mp4"
                    manifest = ImageMotionManifest(
                        beats=tuple(
                            MotionBeat(
                                image_path=beat_path_by_id[beat.visual_beat_id],
                                duration_seconds=duration,
                                camera_movement=beat.camera_movement,
                            )
                            for beat, duration in zip(segment, segment_durations, strict=True)
                        ),
                        audio_path=None,
                        output_path=output_path,
                        width=width,
                        height=height,
                        fps=profile.fps,
                        effects=profile.effects,
                        video_encoder=profile.video_encoder,
                        x264_preset=profile.x264_preset,
                        crf=profile.crf,
                        nvenc_preset=profile.nvenc_preset,
                        nvenc_cq=profile.nvenc_cq,
                        audio_bitrate=profile.audio_bitrate,
                    )
                    await render_image_motion(manifest, timeout_seconds=1800.0)
                    segment_paths.append(output_path)
                    segment_progress = 10 + round(55 * (index + 1) / len(segments))
                    await self.repository.update_progress(
                        claimed,
                        progress=segment_progress,
                        current_step=f"RENDER_PROJECT_SEGMENT_{index + 1}_OF_{len(segments)}",
                    )

                visual_path = job_dir / "project-visual.mp4"
                await concat_video_segments(segment_paths, visual_path)
                await self.repository.update_progress(
                    claimed, progress=70, current_step="RENDER_PROJECT_VIDEO_CONCAT"
                )

                audio_paths = await self._download_audio(chapters, job_dir)
                await self.repository.update_progress(
                    claimed, progress=74, current_step="RENDER_PROJECT_AUDIO_READY"
                )
                master_audio_path = job_dir / "project-master.m4a"
                await concat_audio_parts(
                    audio_paths,
                    master_audio_path,
                    bitrate=profile.audio_bitrate,
                    sample_rate=profile.audio_sample_rate,
                )
                await self.repository.update_progress(
                    claimed, progress=80, current_step="RENDER_PROJECT_AUDIO_CONCAT"
                )

                final_path = job_dir / "project-final.mp4"
                await mux_master_audio(visual_path, master_audio_path, final_path)
                await self.repository.update_progress(
                    claimed, progress=88, current_step="RENDER_PROJECT_MUXED"
                )
                probe = await probe_mp4(final_path)
                validate_probe(
                    probe,
                    width=width,
                    height=height,
                    expected_duration_seconds=claimed.total_duration_ms / 1000.0,
                    tolerance_seconds=max(
                        1.0,
                        len(chapters) * 0.08 + len(segments) / profile.fps + 0.1,
                    ),
                )
                checksum = await asyncio.to_thread(sha256_file, final_path)
                await self.repository.update_progress(
                    claimed, progress=92, current_step="RENDER_PROJECT_VALIDATED"
                )

                async with render_fingerprint_lock(self.settings.database_url, render_fingerprint):
                    await self.repository.assert_lease(claimed)
                    await self.repository.update_progress(
                        claimed, progress=94, current_step="RENDER_PROJECT_UPLOADING"
                    )
                    stored = await self.final_storage.put_immutable(
                        file_path=final_path,
                        render_fingerprint=render_fingerprint,
                        checksum=checksum,
                        generation_job_id=claimed.generation_job_id,
                    )
                    await self.repository.update_progress(
                        claimed, progress=97, current_step="RENDER_PROJECT_FINALIZING"
                    )
                    await self.repository.assert_lease(claimed)
                    await self.repository.complete(
                        claimed,
                        render_fingerprint=render_fingerprint,
                        media_asset=stored,
                        duration_ms=claimed.total_duration_ms,
                        width=width,
                        height=height,
                        fps=profile.fps,
                    )
                self.logger.info(
                    "Completed project render job=%s durationMs=%s segments=%s fileId=%s",
                    claimed.generation_job_id,
                    claimed.total_duration_ms,
                    len(segments),
                    stored.external_file_id,
                )

    async def _download_images(
        self, beats: list[ProjectRenderBeatAsset], job_dir: Path
    ) -> list[Path]:
        assert self.storage is not None
        cached: dict[tuple[str, str], Path] = {}
        paths: list[Path] = []
        for beat in beats:
            key = (beat.storage_key, beat.checksum)
            path = cached.get(key)
            if path is None:
                path = job_dir / f"image-{len(cached):04d}.img"
                await self.storage.download_to_file(
                    beat.storage_key,
                    path,
                    expected_size=beat.size_bytes,
                    expected_checksum=beat.checksum,
                    max_bytes=self.settings.media_max_image_bytes,
                )
                cached[key] = path
            paths.append(path)
        return paths

    async def _download_audio(
        self, chapters: list[ProjectRenderChapterAudio], job_dir: Path
    ) -> list[Path]:
        assert self.storage is not None
        paths: list[Path] = []
        for index, chapter in enumerate(chapters):
            path = job_dir / f"audio-{index:04d}.source"
            await self.storage.download_to_file(
                chapter.storage_key,
                path,
                expected_size=chapter.size_bytes,
                expected_checksum=chapter.checksum,
                max_bytes=self.settings.media_max_audio_bytes,
            )
            paths.append(path)
        return paths

    async def _heartbeat(self, claimed: ClaimedProjectRenderJob) -> None:
        interval = max(2.0, min(20.0, self.settings.lease_seconds / 3))
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(claimed):
                raise ProjectRenderLeaseLostError("Project render heartbeat lease fence failed")


def split_render_segments(
    beats: list[ProjectRenderBeatAsset],
    *,
    max_duration_ms: int = MAX_SEGMENT_DURATION_MS,
    preferred_duration_ms: int = PREFERRED_SEGMENT_DURATION_MS,
) -> list[list[ProjectRenderBeatAsset]]:
    if not beats:
        return []
    if max_duration_ms <= 0 or preferred_duration_ms <= 0:
        raise ValueError("segment durations must be positive")
    if preferred_duration_ms > max_duration_ms:
        preferred_duration_ms = max_duration_ms

    slices = _split_oversized_beats(beats, max_duration_ms=max_duration_ms)
    segments: list[list[ProjectRenderBeatAsset]] = []
    current: list[ProjectRenderBeatAsset] = []
    current_duration = 0
    previous: ProjectRenderBeatAsset | None = None
    for beat in slices:
        boundary = (
            previous is not None
            and (
                beat.chapter_id != previous.chapter_id
                or beat.scene_index != previous.scene_index
            )
        )
        if current and (
            current_duration + beat.duration_ms > max_duration_ms
            or (boundary and current_duration >= preferred_duration_ms)
        ):
            segments.append(current)
            current = []
            current_duration = 0
        current.append(beat)
        current_duration += beat.duration_ms
        previous = beat
    if current:
        segments.append(current)
    return segments


def _split_oversized_beats(
    beats: list[ProjectRenderBeatAsset], *, max_duration_ms: int
) -> list[ProjectRenderBeatAsset]:
    slices: list[ProjectRenderBeatAsset] = []
    for beat in beats:
        start_ms = beat.global_start_ms
        while start_ms < beat.global_end_ms:
            end_ms = min(beat.global_end_ms, start_ms + max_duration_ms)
            slices.append(
                replace(
                    beat,
                    global_start_ms=start_ms,
                    global_end_ms=end_ms,
                    duration_ms=end_ms - start_ms,
                )
            )
            start_ms = end_ms
    return slices


def _frame_quantized_duration_seconds(
    beats: list[ProjectRenderBeatAsset], fps: int
) -> list[float]:
    """Convert global millisecond boundaries to one contiguous frame budget.

    Quantizing each beat duration independently can accumulate many frames of drift on long
    timelines. Quantizing shared global boundaries instead guarantees adjacent beats share the
    same frame boundary. The first beat may start after zero when this helper is used for one
    bounded render segment.
    """
    if fps <= 0:
        raise ValueError("fps must be positive")
    if not beats:
        return []

    previous_end_frame = round(beats[0].global_start_ms * fps / 1000.0)
    durations: list[float] = []
    for beat in beats:
        start_frame = round(beat.global_start_ms * fps / 1000.0)
        end_frame = round(beat.global_end_ms * fps / 1000.0)
        if start_frame != previous_end_frame:
            raise ValueError("Project beat frame timeline is not contiguous")
        if end_frame <= start_frame:
            raise ValueError("Project beat duration is shorter than one render frame")
        durations.append((end_frame - start_frame) / fps)
        previous_end_frame = end_frame
    return durations


def _validate_snapshot(
    chapters: list[ProjectRenderChapterAudio],
    beats: list[ProjectRenderBeatAsset],
    expected_duration_ms: int,
) -> None:
    if not chapters:
        raise ValueError("Project render snapshot has no chapter audio")
    if not beats:
        raise ValueError("Project render snapshot has no READY visual beats")
    chapter_cursor = 0
    for chapter in chapters:
        if chapter.global_start_ms != chapter_cursor:
            raise ValueError("Project chapter timeline is not contiguous")
        if chapter.global_end_ms <= chapter.global_start_ms:
            raise ValueError("Project chapter timeline contains a non-positive interval")
        chapter_cursor = chapter.global_end_ms
    if chapter_cursor != expected_duration_ms:
        raise ValueError("Project chapter timeline does not close at total audio duration")

    beat_cursor = 0
    for beat in beats:
        if beat.global_start_ms != beat_cursor:
            raise ValueError("Project visual beat timeline is not contiguous")
        if beat.global_end_ms - beat.global_start_ms != beat.duration_ms:
            raise ValueError("Project beat duration does not match its global interval")
        beat_cursor = beat.global_end_ms
    if beat_cursor != expected_duration_ms:
        raise ValueError("Project visual timeline does not close at total audio duration")


def _parse_operation_type(value: str) -> tuple[str, str]:
    parts = value.upper().split("_")
    if len(parts) != 4 or parts[0] != "RENDER" or parts[1] != "PROJECT":
        raise ValueError("Project render execution spec is missing from operation plan")
    resolution = parts[2].lower()
    render_format = parts[3].lower()
    if resolution not in {"720p", "1080p"}:
        raise ValueError(f"Unsupported project render resolution: {resolution}")
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
    if aspect_ratio not in mapping:
        raise ValueError(f"Unsupported project render aspect ratio: {aspect_ratio}")
    width, height = mapping[aspect_ratio]
    return width - width % 2, height - height % 2


async def _load_project_render_profile(
    database_url: str, generation_job_id: uuid.UUID
) -> RenderProfile:
    connection = await asyncpg.connect(database_url)
    try:
        raw = await connection.fetchval(
            """
            SELECT render_profile_json
              FROM project_render_input_snapshots
             WHERE generation_job_id = $1
            """,
            generation_job_id,
        )
    finally:
        await connection.close()
    if raw is None:
        raise ValueError("Project render snapshot is missing its pinned render profile")
    return RenderProfile.from_json(raw)


def _render_fingerprint(
    claimed: ClaimedProjectRenderJob,
    chapters: list[ProjectRenderChapterAudio],
    beats: list[ProjectRenderBeatAsset],
    profile: RenderProfile,
    resolution: str,
    render_format: str,
) -> str:
    payload = {
        "version": "project-image-motion-v2-frame-quantized",
        "projectId": str(claimed.project_id),
        "storyVersionId": str(claimed.story_version_id),
        "resolution": resolution,
        "format": render_format,
        "aspectRatio": claimed.aspect_ratio,
        "totalDurationMs": claimed.total_duration_ms,
        "renderer": profile.fingerprint_payload(),
        "chapters": [
            {
                "chapterId": str(chapter.chapter_id),
                "startMs": chapter.global_start_ms,
                "endMs": chapter.global_end_ms,
                "audioChecksum": chapter.checksum,
                "audioDurationMs": chapter.duration_ms,
            }
            for chapter in chapters
        ],
        "beats": [
            {
                "visualBeatId": str(beat.visual_beat_id),
                "startMs": beat.global_start_ms,
                "endMs": beat.global_end_ms,
                "checksum": beat.checksum,
                "cameraMovement": beat.camera_movement,
            }
            for beat in beats
        ],
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
