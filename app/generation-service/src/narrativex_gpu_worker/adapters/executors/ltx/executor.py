from __future__ import annotations

import asyncio
import subprocess
import time
from pathlib import Path, PurePosixPath
from uuid import NAMESPACE_URL, uuid5

import httpx

from narrativex_gpu_worker.adapters.executors.comfyui.client import (
    ComfyUIClient,
    ComfyUIClientError,
)
from narrativex_gpu_worker.application.errors import (
    AmbiguousOutcomeError,
    ExecutionCanceledError,
    ExecutorExecutionError,
    MissingDurableContextError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily, RuntimeRequirement
from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    VideoGenerateInputs,
)
from narrativex_gpu_worker.contracts.task import NativeVideoGenerateInputs

from .media import inspect_native_video
from .preflight import baseline_graph, validate_object_info, verify_runtime_files
from .quality import score_video_quality
from .workflow import (
    CHECKPOINT,
    MANIFEST,
    PROFILE_ID,
    SUPPORTED_STRATEGIES,
    build_ltx_video_workflow,
)


class LtxVideoExecutor:
    """Pinned joint AV executor. Static profile availability is separate from readiness."""

    name = "ltx"
    task_types = frozenset({"video.generate"})
    models = (
        ModelRef(executor="ltx", model=MANIFEST["modelId"], revision=MANIFEST["modelRevision"]),
    )
    task_schema_versions = {"video.generate": ["1.0", "1.1"]}
    workflow_profiles = [dict(profile_id=PROFILE_ID, **MANIFEST["capabilities"])]

    def __init__(
        self,
        client: ComfyUIClient,
        artifact_adapter: ArtifactPort,
        runtime_directory: Path | None = None,
        max_artifact_bytes: int = 2_147_483_648,
    ) -> None:
        self._client = client
        self._artifact_adapter = artifact_adapter
        self._ready = False
        self._runtime_directory = runtime_directory
        self._max_artifact_bytes = max_artifact_bytes
        self._next_recovery: dict[str, float] = {}
        self._next_preflight = 0.0
        self._runtime_verified = False
        self._preflight_lock = asyncio.Lock()
        self.readiness_error = "Runtime preflight has not passed"

    @property
    def ready(self) -> bool:
        return self._ready

    async def preflight(self) -> None:
        self._ready = False
        self._next_preflight = time.monotonic() + 5
        if self._runtime_directory is None:
            return
        try:
            if not self._runtime_verified:
                await asyncio.to_thread(verify_runtime_files, self._runtime_directory)
                self._runtime_verified = True
            async with asyncio.timeout(5):
                validate_object_info(await self._client.object_info(), baseline_graph())
        except (
            OSError,
            ValueError,
            KeyError,
            TypeError,
            subprocess.SubprocessError,
            httpx.HTTPError,
        ) as exc:
            self.readiness_error = str(exc)
            return
        self.readiness_error = ""
        self._ready = True

    async def refresh_preflight(self) -> None:
        # Static pin failures require an explicit preflight/restart after operator repair.
        # Capability probes recover only transient runtime readiness, without rehashing models.
        if not self._runtime_verified or self._ready or time.monotonic() < self._next_preflight:
            return
        async with self._preflight_lock:
            if self._ready or time.monotonic() < self._next_preflight:
                return
            self._next_preflight = time.monotonic() + 5
            await self.preflight()

    @property
    def runtime_requirement(self) -> RuntimeRequirement:
        # INT8 fit on the target workstation still requires a real measured run.
        return RuntimeRequirement(family=RuntimeFamily.LTX_VIDEO, vram_budget_mb=32768)

    async def recover_handle(self, task: ComputeTask) -> str | None:
        prompt = self.prompt_id(task)
        now = time.monotonic()
        if now < self._next_recovery.get(prompt, 0):
            return None
        self._next_recovery[prompt] = now + 5
        return f"ltx:{prompt}" if await self._client.find_prompt(prompt) else None

    @staticmethod
    def prompt_id(task: ComputeTask) -> str:
        return str(uuid5(NAMESPACE_URL, f"narrativex:ltx:{task.task_id}:{task.attempt_id}"))

    async def execute(
        self, task: ComputeTask, cancel: asyncio.Event, context: ExecutionContext | None = None
    ) -> ExecutionOutput:
        resume = context.existing_execution_handle if context else None
        if cancel.is_set():
            if resume:
                raise AmbiguousOutcomeError("LTX cancellation remains unconfirmed")
            raise ExecutionCanceledError("LTX canceled before submit")
        if task.model not in self.models:
            raise ExecutorExecutionError(
                "VIDEO_MODEL_UNAVAILABLE", "Pinned model revision required", "PERMANENT"
            )
        inputs = task.inputs
        assert isinstance(inputs, (VideoGenerateInputs, NativeVideoGenerateInputs))
        if inputs.generation_mode not in SUPPORTED_STRATEGIES:
            raise ExecutorExecutionError(
                "UNSUPPORTED_GENERATION_STRATEGY", "Only verified T2V is available", "PERMANENT"
            )
        if task.artifacts.inputs:
            raise ExecutorExecutionError(
                "VIDEO_REFERENCE_INVALID", "Reference conditioning is unverified", "PERMANENT"
            )
        if len(task.artifacts.outputs) != 1 or task.artifacts.outputs[0].media_type != "video/mp4":
            raise ExecutorExecutionError(
                "VIDEO_OUTPUT_INVALID", "Exactly one MP4 output target required", "PERMANENT"
            )
        if isinstance(inputs, NativeVideoGenerateInputs):
            if inputs.workflow_profile_id != PROFILE_ID:
                raise ExecutorExecutionError(
                    "VIDEO_PROFILE_UNAVAILABLE", "Pinned workflow profile required", "PERMANENT"
                )
            options = {}
            motion_bucket = None
        else:
            options = inputs.provider_options
            motion_bucket = inputs.motion_bucket_id
            if (
                inputs.reference_assets
                or inputs.reference_asset_ids
                or inputs.continuity
                or (inputs.voice_reference and inputs.voice_reference.asset_id)
            ):
                raise ExecutorExecutionError(
                    "VIDEO_REFERENCE_INVALID",
                    "Domain reference fields require a verified profile",
                    "PERMANENT",
                )
        try:
            workflow = build_ltx_video_workflow(
                inputs.prompt,
                inputs.negative_prompt,
                CHECKPOINT,
                inputs.width,
                inputs.height,
                inputs.fps,
                inputs.duration_ms,
                inputs.seed,
                inputs.generation_mode,
                motion_bucket_id=motion_bucket,
                dialogue=inputs.dialogue,
                camera_intent=inputs.camera_intent,
                motion_intent=inputs.motion_intent,
                voice_reference=inputs.voice_reference,
                provider_options=options,
            )
        except ValueError as exc:
            raise ExecutorExecutionError("VIDEO_PROFILE_INVALID", str(exc), "PERMANENT") from exc
        started = time.perf_counter()
        prompt = self.prompt_id(task)
        client_id = f"narrativex-{prompt}"
        if resume:
            if not resume.startswith("ltx:") or resume[4:] != prompt:
                raise AmbiguousOutcomeError("Persisted handle differs from pinned correlation")
        else:
            if context is None or context.save_submitting is None or context.save_handle is None:
                raise MissingDurableContextError("Durable submission callbacks are required")
            # Persist correlation before network I/O. Recovery only queries this identifier.
            await context.save_handle(f"ltx:{prompt}")
            await context.save_submitting()
            try:
                await self._client.submit_prompt(workflow, client_id, prompt_id=prompt)
                await context.save_handle(f"ltx:{prompt}")
            except ComfyUIClientError as exc:
                raise ExecutorExecutionError(
                    "VIDEO_GENERATION_FAILED", str(exc), "PERMANENT"
                ) from exc
        try:
            record = await self._client.wait_for_completion(prompt, client_id, cancel)
        except ComfyUIClientError as exc:
            raise ExecutorExecutionError("VIDEO_GENERATION_FAILED", str(exc), "PERMANENT") from exc
        except httpx.HTTPError as exc:
            raise AmbiguousOutcomeError("LTX completion transport is unresolved") from exc
        if cancel.is_set():
            raise AmbiguousOutcomeError("LTX cancellation remains unconfirmed")
        output = record.get("outputs", {}).get(MANIFEST["outputNode"], {})
        files = output.get(MANIFEST["outputSlot"], [])
        if len(files) != 1 or not output.get("animated"):
            raise ExecutorExecutionError(
                "VIDEO_OUTPUT_INVALID", "Pinned SaveVideo output missing", "PERMANENT"
            )
        file = files[0]
        filename = file.get("filename", "")
        folder = file.get("subfolder", "")
        if (
            PurePosixPath(filename).name != filename
            or "\\" in filename
            or not filename.lower().endswith(".mp4")
            or file.get("type") != "output"
            or PurePosixPath(folder).is_absolute()
            or ".." in PurePosixPath(folder).parts
            or "\\" in folder
            or ":" in folder
        ):
            raise ExecutorExecutionError(
                "VIDEO_OUTPUT_INVALID", "Invalid SaveVideo artifact key", "PERMANENT"
            )
        data = bytearray()
        async for chunk in self._client.download_image_stream(filename, folder, "output"):
            data.extend(chunk)
            if len(data) > self._max_artifact_bytes:
                raise ExecutorExecutionError(
                    "VIDEO_OUTPUT_INVALID", "Video exceeds worker byte limit", "PERMANENT"
                )
        if len(data) < 32 or data[4:8] != b"ftyp":
            raise ExecutorExecutionError(
                "VIDEO_OUTPUT_INVALID", "SaveVideo returned invalid MP4 bytes", "PERMANENT"
            )
        if cancel.is_set():
            raise AmbiguousOutcomeError("LTX cancellation remains unconfirmed")
        try:
            metadata = await inspect_native_video(bytes(data))
        except (OSError, TimeoutError) as exc:
            raise ExecutorExecutionError(
                "VIDEO_VALIDATION_UNAVAILABLE", "Native media inspection unavailable", "TRANSIENT"
            ) from exc
        except ValueError as exc:
            raise ExecutorExecutionError("VIDEO_OUTPUT_INVALID", str(exc), "PERMANENT") from exc
        # Advisory only: scoring reports UNAVAILABLE instead of failing a decodable take.
        quality = await score_video_quality(bytes(data), duration_ms=metadata.duration_ms)
        metadata = metadata.model_copy(update={"quality_metrics": quality})
        if cancel.is_set():
            raise ExecutionCanceledError("LTX canceled after confirmed generation and validation")
        produced = await self._artifact_adapter.upload(task.artifacts.outputs[0], bytes(data))
        produced = produced.model_copy(update={"technical_metadata": metadata})
        return ExecutionOutput(
            outputs=[produced],
            execution_handle=f"ltx:{prompt}",
            metrics=ExecutionMetrics(runtime_ms=int((time.perf_counter() - started) * 1000)),
        )
