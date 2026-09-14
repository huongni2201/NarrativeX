import json

import httpx
import pytest
from pydantic import BaseModel

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.qwen import QwenOpenAITransport, QwenSubmissionUnknownError


class _StructuredReply(BaseModel):
    narration: str


def _transport() -> QwenOpenAITransport:
    return QwenOpenAITransport(
        WorkerSettings(
            provider_mode="qwen",
            qwen_base_url="http://qwen:8000/v1/",
            qwen_model="Qwen/Qwen3-8B-AWQ",
        )
    )


@pytest.mark.asyncio
async def test_qwen_uses_private_openai_contract_with_non_thinking_structured_output() -> None:
    captured: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "qwen-response-1",
                "choices": [{"message": {"content": '{"narration":"Bản kể tiếng Việt"}'}}],
                "usage": {
                    "prompt_tokens": 120,
                    "completion_tokens": 12,
                    "total_tokens": 132,
                },
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result, usage, response_id = await _transport()._generate_structured(  # noqa: SLF001
            client,
            "Translate safely",
            _StructuredReply,
        )

    assert captured["url"] == "http://qwen:8000/v1/chat/completions"
    body = captured["body"]
    assert isinstance(body, dict)
    assert body["model"] == "Qwen/Qwen3-8B-AWQ"
    assert body["chat_template_kwargs"] == {"enable_thinking": False}
    assert body["response_format"]["type"] == "json_schema"
    assert result == _StructuredReply(narration="Bản kể tiếng Việt")
    assert usage.prompt_tokens == 120
    assert usage.candidate_tokens == 12
    assert usage.traffic_type == "local"
    assert response_id == "qwen-response-1"


@pytest.mark.asyncio
async def test_qwen_network_ambiguity_fails_closed() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(QwenSubmissionUnknownError, match="outcome is unknown"):
            await _transport()._generate_structured(  # noqa: SLF001
                client,
                "Translate safely",
                _StructuredReply,
            )


@pytest.mark.asyncio
async def test_qwen_invalid_structured_result_is_conclusive_failure() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        del request
        return httpx.Response(
            200,
            json={
                "id": "qwen-response-2",
                "choices": [{"message": {"content": '{"wrong":"shape"}'}}],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result, usage, response_id = await _transport()._generate_structured(  # noqa: SLF001
            client,
            "Translate safely",
            _StructuredReply,
        )

    assert result is None
    assert usage.total_tokens == 0
    assert response_id == "qwen-response-2"
