import asyncio
import hashlib
import json

import httpx
import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchOperation,
    ImageGenerationRequest,
    ImageReference,
)
from narrativex_worker.providers.realvisxl import RealVisXLBatchImageProvider
from narrativex_worker.schema import ImageAspectRatio, ProviderOperationStatus


def _request(*references: ImageReference) -> ImageGenerationRequest:
    prompt = "cinematic Vietnamese story frame"
    return ImageGenerationRequest(
        request_fingerprint=hashlib.sha256(prompt.encode()).hexdigest(),
        prompt=prompt,
        negative_prompt="text, watermark",
        aspect_ratio=ImageAspectRatio.RATIO_16_9,
        provider_key="realvisxl",
        model_key="realvisxl-local.safetensors",
        location="local",
        references=references,
    )


def _png(width: int = 1024, height: int = 576) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x02\x00\x00\x00"
    )


@pytest.mark.asyncio
async def test_submit_persists_comfyui_prompt_id_and_uses_request_model() -> None:
    captured: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/prompt"
        body = json.loads(request.content)
        captured.update(body)
        return httpx.Response(200, json={"prompt_id": "prompt-123", "node_errors": {}})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = RealVisXLBatchImageProvider(
        WorkerSettings(image_provider_mode="realvisxl"), client=client
    )
    item = ImageBatchItem("beat-1", _request())

    operation = await provider.submit_batch((item,))

    assert operation.status is ProviderOperationStatus.SUBMITTED
    assert operation.operation_id == "prompt-123"
    workflow = captured["prompt"]
    assert isinstance(workflow, dict)
    assert workflow["1"]["inputs"]["ckpt_name"] == "realvisxl-local.safetensors"
    assert workflow["4"]["inputs"]["width"] == 1024
    assert workflow["4"]["inputs"]["height"] == 576
    await provider.aclose()


@pytest.mark.asyncio
async def test_reconcile_materializes_completed_comfyui_png() -> None:
    image = _png()

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/history/prompt-123":
            return httpx.Response(
                200,
                json={
                    "prompt-123": {
                        "status": {"completed": True, "status_str": "success"},
                        "outputs": {
                            "7": {
                                "images": [
                                    {
                                        "filename": "frame.png",
                                        "subfolder": "NarrativeX",
                                        "type": "output",
                                    }
                                ]
                            }
                        },
                    }
                },
            )
        if request.url.path == "/view":
            return httpx.Response(200, content=image)
        raise AssertionError(f"unexpected request: {request.url}")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = RealVisXLBatchImageProvider(
        WorkerSettings(image_provider_mode="realvisxl"), client=client
    )
    item = ImageBatchItem("beat-1", _request())

    resolved = await provider.reconcile_batch(
        ImageBatchOperation(
            provider_key="realvisxl",
            operation_id="prompt-123",
            status=ProviderOperationStatus.SUBMITTED,
            items=(item,),
        )
    )

    assert resolved.status is ProviderOperationStatus.COMPLETED
    assert len(resolved.results) == 1
    assert resolved.results[0].result is not None
    assert resolved.results[0].result.width == 1024
    assert resolved.results[0].result.height == 576
    assert resolved.results[0].result.result_fingerprint == hashlib.sha256(image).hexdigest()
    await provider.aclose()


class _ReferenceStore:
    def __init__(self, content: bytes) -> None:
        self.content = content

    async def get_bytes(self, storage_key: str) -> bytes:
        assert storage_key == "characters/lan.png"
        return self.content


@pytest.mark.asyncio
async def test_character_reference_fails_closed_without_reference_workflow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("REALVISXL_REFERENCE_WORKFLOW_PATH", raising=False)
    content = b"reference-image"
    reference = ImageReference(
        asset_id="asset-1",
        character_name="Lan",
        role="PRIMARY",
        storage_key="characters/lan.png",
        mime_type="image/png",
        sha256=hashlib.sha256(content).hexdigest(),
    )

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/upload/image"
        return httpx.Response(
            200,
            json={"name": "uploaded.png", "subfolder": "narrativex"},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = RealVisXLBatchImageProvider(
        WorkerSettings(image_provider_mode="realvisxl"),
        reference_store=_ReferenceStore(content),
        client=client,
    )

    operation = await provider.submit_batch((ImageBatchItem("beat-1", _request(reference)),))

    assert operation.status is ProviderOperationStatus.FAILED
    assert operation.error_code == "REALVISXL_REFERENCE_WORKFLOW_REQUIRED"
    await provider.aclose()


def test_realvisxl_rejects_multi_item_provider_batch() -> None:
    provider = RealVisXLBatchImageProvider(WorkerSettings(image_provider_mode="realvisxl"))

    async def run() -> None:
        operation = await provider.submit_batch(
            (
                ImageBatchItem("beat-1", _request()),
                ImageBatchItem("beat-2", _request()),
            )
        )
        assert operation.status is ProviderOperationStatus.FAILED
        assert operation.error_code == "REALVISXL_SINGLE_GPU_BATCH_REQUIRED"

    asyncio.run(run())
