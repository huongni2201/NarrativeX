"""Durable local RealVisXL adapter backed by the ComfyUI HTTP API.

The adapter deliberately keeps ComfyUI behind NarrativeX's provider-neutral batch contract.
A provider prompt id is persisted before reconciliation, so a worker restart never causes a blind
paid/local-GPU resubmission. Production runs one item per provider operation on the single GPU.

Character-reference requests are never silently downgraded to text-only generation. When a request
contains immutable references, REALVISXL_REFERENCE_WORKFLOW_PATH must point at a ComfyUI API-format
workflow. NarrativeX uploads the verified references and substitutes the placeholders documented in
``_template_values``.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections.abc import AsyncIterator, Mapping, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageGenerationResult,
    ImageProviderError,
    ImageReference,
    ImageSubmissionUnknownError,
    ReferenceObjectStore,
    batch_fingerprint,
)
from narrativex_worker.providers.ports import ProviderCapabilities
from narrativex_worker.schema import ImageAspectRatio, ModerationDecision, ProviderOperationStatus

_PROVIDER_KEY = "realvisxl"
_DEFAULT_BASE_URL = "http://host.docker.internal:8188"
_DEFAULT_NEGATIVE = (
    "text, watermark, logo, signature, low quality, blurry, deformed, bad anatomy, "
    "extra fingers, extra limbs"
)


class RealVisXLProviderError(ImageProviderError):
    """Deterministic RealVisXL/ComfyUI configuration or output failure."""


class RealVisXLSubmissionUnknownError(ImageSubmissionUnknownError):
    """ComfyUI may have accepted a prompt but the submission response was lost."""


class RealVisXLBatchImageProvider:
    """One-GPU RealVisXL provider using durable ComfyUI prompt ids."""

    def __init__(
        self,
        settings: WorkerSettings,
        reference_store: ReferenceObjectStore | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings
        self.reference_store = reference_store
        self.base_url = _setting(
            settings,
            "realvisxl_base_url",
            os.getenv("REALVISXL_BASE_URL", _DEFAULT_BASE_URL),
        ).rstrip("/")
        self.timeout_seconds = float(
            _setting(
                settings,
                "realvisxl_timeout_seconds",
                os.getenv("REALVISXL_TIMEOUT_SECONDS", "120"),
            )
        )
        self._client = client

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            _PROVIDER_KEY,
            supports_story_analysis=False,
            supports_image_generation=True,
            supports_operation_reconciliation=True,
        )

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        batch_items = tuple(items)
        if len(batch_items) != 1:
            return _failed(
                batch_items,
                "REALVISXL_SINGLE_GPU_BATCH_REQUIRED",
                "RealVisXL accepts exactly one durable image item per provider operation",
            )

        item = batch_items[0]
        try:
            workflow = await self._workflow(item)
        except RealVisXLProviderError as exception:
            return _failed(batch_items, _error_code(exception), str(exception))

        fingerprint = batch_fingerprint(batch_items)
        body = {
            "prompt": workflow,
            "client_id": f"narrativex-{fingerprint[:24]}",
            "extra_data": {
                "narrativex_batch_fingerprint": fingerprint,
                "narrativex_item_key": item.item_key,
                "narrativex_request_fingerprint": item.request.request_fingerprint,
            },
        }
        try:
            async with self._client_context() as client:
                response = await client.post(f"{self.base_url}/prompt", json=body)
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise RealVisXLSubmissionUnknownError(
                "REALVISXL_SUBMISSION_OUTCOME_UNKNOWN"
            ) from exception

        if response.status_code >= 500:
            raise RealVisXLSubmissionUnknownError(
                f"REALVISXL_SUBMISSION_HTTP_{response.status_code}_UNKNOWN"
            )
        if response.is_error:
            return _failed(
                batch_items,
                f"REALVISXL_HTTP_{response.status_code}",
                _response_detail(response),
            )

        payload = _json_object(response)
        prompt_id = payload.get("prompt_id")
        if not isinstance(prompt_id, str) or not prompt_id:
            raise RealVisXLSubmissionUnknownError("REALVISXL_PROMPT_ID_MISSING")
        node_errors = payload.get("node_errors")
        if isinstance(node_errors, Mapping) and node_errors:
            return _failed(batch_items, "REALVISXL_NODE_VALIDATION_FAILED", str(node_errors)[:1000])
        return ImageBatchOperation(
            provider_key=_PROVIDER_KEY,
            operation_id=prompt_id,
            status=ProviderOperationStatus.SUBMITTED,
            items=batch_items,
        )

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        if operation.operation_id is None:
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=None,
                status=ProviderOperationStatus.UNKNOWN,
                items=operation.items,
                error_code="REALVISXL_PROMPT_ID_MISSING",
            )
        try:
            async with self._client_context() as client:
                response = await client.get(
                    f"{self.base_url}/history/{quote(operation.operation_id, safe='')}"
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise RealVisXLProviderError("REALVISXL_RECONCILE_UNAVAILABLE") from exception

        if response.status_code == 404:
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.RUNNING,
                items=operation.items,
            )
        if response.is_error:
            raise RealVisXLProviderError(f"REALVISXL_RECONCILE_HTTP_{response.status_code}")

        history = _json_object(response)
        raw_record = history.get(operation.operation_id)
        if not isinstance(raw_record, Mapping):
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.RUNNING,
                items=operation.items,
            )
        if not _history_completed(raw_record):
            if _history_failed(raw_record):
                return _failed(
                    operation.items,
                    "REALVISXL_EXECUTION_FAILED",
                    _history_error(raw_record),
                    operation_id=operation.operation_id,
                )
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.RUNNING,
                items=operation.items,
            )

        try:
            content = await self._download_output(raw_record)
            result = _image_result(content, operation.items[0])
        except RealVisXLProviderError as exception:
            return _failed(
                operation.items,
                _error_code(exception),
                str(exception),
                operation_id=operation.operation_id,
            )
        item = operation.items[0]
        return ImageBatchOperation(
            provider_key=_PROVIDER_KEY,
            operation_id=operation.operation_id,
            status=ProviderOperationStatus.COMPLETED,
            items=operation.items,
            results=(
                ImageBatchItemResult(
                    item_key=item.item_key,
                    request_fingerprint=item.request.request_fingerprint,
                    result=result,
                ),
            ),
        )

    async def recover_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        """Resolve an ambiguous submission without ever re-submitting it blindly."""
        if operation.operation_id:
            return await self.reconcile_batch(operation)
        fingerprint = batch_fingerprint(operation.items)
        try:
            async with self._client_context() as client:
                response = await client.get(f"{self.base_url}/history")
        except (httpx.TimeoutException, httpx.NetworkError):
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=None,
                status=ProviderOperationStatus.UNKNOWN,
                items=operation.items,
                error_code="REALVISXL_RECOVERY_UNAVAILABLE",
            )
        if response.is_error:
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=None,
                status=ProviderOperationStatus.UNKNOWN,
                items=operation.items,
                error_code=f"REALVISXL_RECOVERY_HTTP_{response.status_code}",
            )
        history = _json_object(response)
        prompt_id = _find_prompt_by_fingerprint(history, fingerprint)
        if prompt_id is None:
            return ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=None,
                status=ProviderOperationStatus.UNKNOWN,
                items=operation.items,
                error_code="REALVISXL_SUBMISSION_UNRESOLVED",
            )
        return await self.reconcile_batch(
            ImageBatchOperation(
                provider_key=_PROVIDER_KEY,
                operation_id=prompt_id,
                status=ProviderOperationStatus.SUBMITTED,
                items=operation.items,
            )
        )

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()

    async def _workflow(self, item: ImageBatchItem) -> dict[str, Any]:
        request = item.request
        width, height = _dimensions(request.aspect_ratio)
        seed = int(request.request_fingerprint[:16], 16) & 0x7FFF_FFFF_FFFF_FFFF
        checkpoint = request.model_key.strip()
        if not checkpoint:
            raise RealVisXLProviderError("REALVISXL_CHECKPOINT_REQUIRED")
        references = await self._upload_references(request.references)
        if references:
            template_path = os.getenv("REALVISXL_REFERENCE_WORKFLOW_PATH", "").strip()
            if not template_path:
                raise RealVisXLProviderError("REALVISXL_REFERENCE_WORKFLOW_REQUIRED")
            try:
                raw = json.loads(Path(template_path).read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exception:
                raise RealVisXLProviderError("REALVISXL_REFERENCE_WORKFLOW_INVALID") from exception
            if not isinstance(raw, dict):
                raise RealVisXLProviderError("REALVISXL_REFERENCE_WORKFLOW_INVALID")
            return _substitute_template(
                raw,
                _template_values(item, checkpoint, width, height, seed, references),
            )
        return _default_workflow(item, checkpoint, width, height, seed)

    async def _upload_references(
        self, references: tuple[ImageReference, ...]
    ) -> tuple[str, ...]:
        if not references:
            return ()
        if len(references) > 3:
            raise RealVisXLProviderError("REALVISXL_MAX_3_REFERENCES")
        if self.reference_store is None:
            raise RealVisXLProviderError("REALVISXL_REFERENCE_STORE_REQUIRED")
        uploaded: list[str] = []
        for index, reference in enumerate(references, start=1):
            content = await self.reference_store.get_bytes(reference.storage_key)
            if hashlib.sha256(content).hexdigest() != reference.sha256.lower():
                raise RealVisXLProviderError(f"REFERENCE_CHECKSUM_MISMATCH:{reference.asset_id}")
            extension = _extension(reference.mime_type)
            filename = f"narrativex/{reference.sha256.lower()}.{extension}"
            try:
                async with self._client_context() as client:
                    response = await client.post(
                        f"{self.base_url}/upload/image",
                        data={"type": "input", "overwrite": "true"},
                        files={"image": (filename, content, reference.mime_type)},
                    )
            except (httpx.TimeoutException, httpx.NetworkError) as exception:
                raise RealVisXLProviderError(
                    f"REALVISXL_REFERENCE_UPLOAD_FAILED:{index}"
                ) from exception
            if response.is_error:
                raise RealVisXLProviderError(
                    f"REALVISXL_REFERENCE_UPLOAD_HTTP_{response.status_code}:{index}"
                )
            payload = _json_object(response)
            name = payload.get("name")
            subfolder = payload.get("subfolder")
            if not isinstance(name, str) or not name:
                raise RealVisXLProviderError("REALVISXL_REFERENCE_UPLOAD_RESPONSE_INVALID")
            uploaded.append(
                f"{subfolder}/{name}" if isinstance(subfolder, str) and subfolder else name
            )
        return tuple(uploaded)

    async def _download_output(self, record: Mapping[str, Any]) -> bytes:
        output = _first_output_image(record)
        filename = output.get("filename")
        if not isinstance(filename, str) or not filename:
            raise RealVisXLProviderError("REALVISXL_OUTPUT_FILENAME_MISSING")
        params = {
            "filename": filename,
            "subfolder": str(output.get("subfolder") or ""),
            "type": str(output.get("type") or "output"),
        }
        try:
            async with self._client_context() as client:
                response = await client.get(f"{self.base_url}/view", params=params)
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise RealVisXLProviderError("REALVISXL_OUTPUT_DOWNLOAD_FAILED") from exception
        if response.is_error:
            raise RealVisXLProviderError(f"REALVISXL_OUTPUT_HTTP_{response.status_code}")
        return response.content

    @asynccontextmanager
    async def _client_context(self) -> AsyncIterator[httpx.AsyncClient]:
        if self._client is not None:
            yield self._client
            return
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            yield client


def _default_workflow(
    item: ImageBatchItem,
    checkpoint: str,
    width: int,
    height: int,
    seed: int,
) -> dict[str, Any]:
    request = item.request
    negative = request.negative_prompt or _DEFAULT_NEGATIVE
    steps = int(os.getenv("REALVISXL_STEPS", "28"))
    cfg = float(os.getenv("REALVISXL_CFG", "5.5"))
    sampler = os.getenv("REALVISXL_SAMPLER", "dpmpp_2m_sde")
    scheduler = os.getenv("REALVISXL_SCHEDULER", "karras")
    filename_prefix = f"NarrativeX/{request.request_fingerprint[:16]}"
    workflow: dict[str, Any] = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": request.prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative, "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": sampler,
                "scheduler": scheduler,
                "denoise": 1.0,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": filename_prefix, "images": ["6", 0]},
        },
    }
    lora_name = os.getenv("REALVISXL_LORA_NAME", "").strip()
    if not lora_name:
        return workflow
    strength = float(os.getenv("REALVISXL_LORA_STRENGTH", "0.65"))
    workflow["8"] = {
        "class_type": "LoraLoader",
        "inputs": {
            "lora_name": lora_name,
            "strength_model": strength,
            "strength_clip": strength,
            "model": ["1", 0],
            "clip": ["1", 1],
        },
    }
    workflow["2"]["inputs"]["clip"] = ["8", 1]
    workflow["3"]["inputs"]["clip"] = ["8", 1]
    workflow["5"]["inputs"]["model"] = ["8", 0]
    return workflow


def _template_values(
    item: ImageBatchItem,
    checkpoint: str,
    width: int,
    height: int,
    seed: int,
    references: tuple[str, ...],
) -> dict[str, object]:
    request = item.request
    values: dict[str, object] = {
        "{{PROMPT}}": request.prompt,
        "{{NEGATIVE_PROMPT}}": request.negative_prompt or _DEFAULT_NEGATIVE,
        "{{CHECKPOINT}}": checkpoint,
        "{{WIDTH}}": width,
        "{{HEIGHT}}": height,
        "{{SEED}}": seed,
        "{{FILENAME_PREFIX}}": f"NarrativeX/{request.request_fingerprint[:16]}",
        "{{LORA_NAME}}": os.getenv("REALVISXL_LORA_NAME", ""),
        "{{LORA_STRENGTH}}": float(os.getenv("REALVISXL_LORA_STRENGTH", "0.65")),
    }
    for index, reference in enumerate(references, start=1):
        values[f"{{{{REFERENCE_IMAGE_{index}}}}}"] = reference
    return values


def _substitute_template(value: Any, replacements: Mapping[str, object]) -> Any:
    if isinstance(value, dict):
        return {key: _substitute_template(item, replacements) for key, item in value.items()}
    if isinstance(value, list):
        return [_substitute_template(item, replacements) for item in value]
    if not isinstance(value, str):
        return value
    if value in replacements:
        return replacements[value]
    rendered = value
    for token, replacement in replacements.items():
        rendered = rendered.replace(token, str(replacement))
    return rendered


def _dimensions(aspect_ratio: ImageAspectRatio) -> tuple[int, int]:
    return {
        ImageAspectRatio.RATIO_16_9: (1024, 576),
        ImageAspectRatio.RATIO_9_16: (576, 1024),
        ImageAspectRatio.RATIO_1_1: (1024, 1024),
        ImageAspectRatio.RATIO_4_3: (1024, 768),
        ImageAspectRatio.RATIO_3_4: (768, 1024),
    }[aspect_ratio]


def _image_result(content: bytes, item: ImageBatchItem) -> ImageGenerationResult:
    if len(content) > item.request.max_output_bytes:
        raise RealVisXLProviderError("REALVISXL_OUTPUT_TOO_LARGE")
    width, height = _png_dimensions(content)
    fingerprint = hashlib.sha256(content).hexdigest()
    return ImageGenerationResult(
        mime_type="image/png",
        content=content,
        width=width,
        height=height,
        moderation=ModerationDecision.SAFE,
        result_fingerprint=fingerprint,
        provider_metadata={"provider": _PROVIDER_KEY, "model": item.request.model_key},
    )


def _png_dimensions(content: bytes) -> tuple[int, int]:
    if len(content) < 24 or content[:8] != b"\x89PNG\r\n\x1a\n" or content[12:16] != b"IHDR":
        raise RealVisXLProviderError("REALVISXL_OUTPUT_NOT_PNG")
    return int.from_bytes(content[16:20], "big"), int.from_bytes(content[20:24], "big")


def _first_output_image(record: Mapping[str, Any]) -> Mapping[str, Any]:
    outputs = record.get("outputs")
    if not isinstance(outputs, Mapping):
        raise RealVisXLProviderError("REALVISXL_OUTPUT_MISSING")
    for node in outputs.values():
        if not isinstance(node, Mapping):
            continue
        images = node.get("images")
        if isinstance(images, list) and images and isinstance(images[0], Mapping):
            return images[0]
    raise RealVisXLProviderError("REALVISXL_OUTPUT_MISSING")


def _history_completed(record: Mapping[str, Any]) -> bool:
    status = record.get("status")
    if not isinstance(status, Mapping):
        return bool(record.get("outputs"))
    return bool(status.get("completed")) or status.get("status_str") == "success"


def _history_failed(record: Mapping[str, Any]) -> bool:
    status = record.get("status")
    if not isinstance(status, Mapping):
        return False
    return status.get("status_str") in {"error", "failed"}


def _history_error(record: Mapping[str, Any]) -> str:
    status = record.get("status")
    if isinstance(status, Mapping):
        messages = status.get("messages")
        if messages:
            return str(messages)[:1000]
    return "ComfyUI execution failed"


def _find_prompt_by_fingerprint(history: Mapping[str, Any], fingerprint: str) -> str | None:
    matches: list[str] = []
    for prompt_id, record in history.items():
        if not isinstance(prompt_id, str) or not isinstance(record, Mapping):
            continue
        prompt = record.get("prompt")
        if not isinstance(prompt, list):
            continue
        for part in reversed(prompt):
            if not isinstance(part, Mapping):
                continue
            if part.get("narrativex_batch_fingerprint") == fingerprint:
                matches.append(prompt_id)
                break
            extra = part.get("extra_data")
            if (
                isinstance(extra, Mapping)
                and extra.get("narrativex_batch_fingerprint") == fingerprint
            ):
                matches.append(prompt_id)
                break
    return sorted(matches)[-1] if matches else None


def _failed(
    items: Sequence[ImageBatchItem],
    code: str,
    detail: str | None = None,
    *,
    operation_id: str | None = None,
) -> ImageBatchOperation:
    return ImageBatchOperation(
        provider_key=_PROVIDER_KEY,
        operation_id=operation_id,
        status=ProviderOperationStatus.FAILED,
        items=tuple(items),
        error_code=code[:80],
        error_detail=(detail or code)[:2000],
    )


def _error_code(exception: BaseException) -> str:
    text = str(exception).strip()
    if text and " " not in text:
        return text.upper()[:80]
    return type(exception).__name__.upper()[:80]


def _json_object(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exception:
        raise RealVisXLProviderError("REALVISXL_RESPONSE_NOT_JSON") from exception
    if not isinstance(payload, dict):
        raise RealVisXLProviderError("REALVISXL_RESPONSE_NOT_OBJECT")
    return payload


def _response_detail(response: httpx.Response) -> str:
    return response.text.strip()[:1000] or f"HTTP {response.status_code}"


def _extension(mime_type: str) -> str:
    return {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(
        mime_type.lower(), "bin"
    )


def _setting(settings: WorkerSettings, name: str, fallback: str) -> str:
    value = getattr(settings, name, None)
    if value is None:
        return fallback
    return str(value)
