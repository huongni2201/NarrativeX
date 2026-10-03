"""Mock transport failure checks, not GPU readiness evidence."""

import asyncio
import json
from uuid import NAMESPACE_URL, uuid5

import httpx
import pytest

from narrativex_gpu_worker.adapters.executors.comfyui.client import ComfyUIClient
from narrativex_gpu_worker.application.errors import AmbiguousOutcomeError


async def test_lost_ack_reconciles_the_same_uuid_without_second_post():
    prompt_id = str(uuid5(NAMESPACE_URL, "narrativex:ltx:task:attempt"))
    posts = []

    def handler(request):
        if request.url.path == "/prompt":
            posts.append(json.loads(request.content))
            raise httpx.ReadTimeout("ACK lost")
        if request.url.path.startswith("/history/"):
            return httpx.Response(200, json={prompt_id: {"status": {"completed": True}}})
        return httpx.Response(200, json={"queue_running": [], "queue_pending": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = ComfyUIClient(client=http)
        assert await client.submit_prompt({}, "client", prompt_id=prompt_id) == prompt_id
    assert len(posts) == 1
    assert posts[0]["prompt_id"] == prompt_id


async def test_unresolved_ack_is_unknown_not_failed():
    def handler(request):
        if request.url.path == "/prompt":
            raise httpx.ReadTimeout("ACK lost")
        return httpx.Response(200, json={})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(AmbiguousOutcomeError):
            await ComfyUIClient(client=http).submit_prompt({}, "client", prompt_id="correlation")


async def test_local_cancellation_does_not_claim_engine_canceled():
    cancel = asyncio.Event()
    cancel.set()
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={}))
    ) as http:
        with pytest.raises(AmbiguousOutcomeError):
            await ComfyUIClient(client=http).poll_history("prompt", cancel)
