import httpx
import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.media import I2vResolution
from narrativex_worker.providers.ports import (
    ProviderSubmissionRejectedError,
    VideoGenerationRequest,
    VideoProviderOperation,
)
from narrativex_worker.providers.wan import WanSubmissionUnknownError, WanVideoProvider
from narrativex_worker.schema import ProviderOperationStatus


def _settings() -> WorkerSettings:
    return WorkerSettings(
        wan_video_enabled=True,
        wan_endpoint_url="https://wan.internal",
        wan_api_token="test-token",
    )


def _request() -> VideoGenerationRequest:
    return VideoGenerationRequest(
        request_id="scene-request-1",
        image_url="https://assets.internal/keyframe.png",
        prompt="The character slowly turns toward camera.",
        duration_seconds=5,
        resolution=I2vResolution.P480,
    )


@pytest.mark.asyncio
async def test_submit_and_fetch_completed_operation() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "POST":
            return httpx.Response(
                202,
                json={"operation_id": "op-1", "status": "SUBMITTED"},
            )
        return httpx.Response(
            200,
            json={
                "operation_id": "op-1",
                "status": "COMPLETED",
                "output_url": "https://assets.internal/op-1.mp4",
            },
        )

    provider = WanVideoProvider(_settings(), transport=httpx.MockTransport(handler))
    submitted = await provider.submit(_request())
    assert submitted.status is ProviderOperationStatus.SUBMITTED
    assert submitted.operation_id == "op-1"

    completed = await provider.get_status(submitted)
    assert completed.status is ProviderOperationStatus.COMPLETED
    assert completed.output_url == "https://assets.internal/op-1.mp4"
    assert seen[0].headers["authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_reconcile_uses_request_identity_when_submit_response_was_lost() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path.endswith("/v1/operations/by-request/scene-request-1")
        return httpx.Response(
            200,
            json={"operation_id": "op-recovered", "status": "RUNNING"},
        )

    provider = WanVideoProvider(_settings(), transport=httpx.MockTransport(handler))
    unknown = VideoProviderOperation(
        provider_key="wan-local",
        request_id="scene-request-1",
        operation_id=None,
        status=ProviderOperationStatus.UNKNOWN,
    )

    recovered = await provider.reconcile(unknown)
    assert recovered.operation_id == "op-recovered"
    assert recovered.status is ProviderOperationStatus.RUNNING


@pytest.mark.asyncio
async def test_submit_4xx_is_definitive_rejection() -> None:
    provider = WanVideoProvider(
        _settings(),
        transport=httpx.MockTransport(lambda request: httpx.Response(400, json={})),
    )
    with pytest.raises(ProviderSubmissionRejectedError):
        await provider.submit(_request())


@pytest.mark.asyncio
async def test_submit_5xx_is_unknown_not_blind_retryable() -> None:
    provider = WanVideoProvider(
        _settings(),
        transport=httpx.MockTransport(lambda request: httpx.Response(503, json={})),
    )
    with pytest.raises(WanSubmissionUnknownError):
        await provider.submit(_request())


@pytest.mark.asyncio
async def test_status_network_failure_becomes_unknown() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timeout", request=request)

    provider = WanVideoProvider(_settings(), transport=httpx.MockTransport(handler))
    operation = VideoProviderOperation(
        provider_key="wan-local",
        request_id="scene-request-1",
        operation_id="op-1",
        status=ProviderOperationStatus.RUNNING,
    )

    result = await provider.get_status(operation)
    assert result.status is ProviderOperationStatus.UNKNOWN
    assert result.error_code == "STATUS_UNAVAILABLE"
