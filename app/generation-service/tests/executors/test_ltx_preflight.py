"""Pinned-schema mocked preflight, never a GPU readiness claim."""

from copy import deepcopy
from unittest.mock import AsyncMock

import httpx
import pytest

from narrativex_gpu_worker.adapters.executors.ltx.preflight import (
    baseline_graph,
    validate_object_info,
)
from narrativex_gpu_worker.adapters.executors.ltx.workflow import MANIFEST


async def test_delayed_dependency_readiness_refresh_is_throttled_and_recovers(
    monkeypatch, tmp_path
):
    from narrativex_gpu_worker.adapters.executors.ltx import executor as module
    from narrativex_gpu_worker.adapters.executors.ltx.executor import LtxVideoExecutor

    clock = [10.0]
    monkeypatch.setattr(module.time, "monotonic", lambda: clock[0])
    verification = []
    monkeypatch.setattr(module, "verify_runtime_files", lambda path: verification.append(path))
    client = AsyncMock()
    client.object_info.side_effect = [
        httpx.ConnectError("booting"),
        info_for_graph(baseline_graph()),
    ]
    executor = LtxVideoExecutor(client, AsyncMock(), runtime_directory=tmp_path)
    await executor.preflight()
    assert not executor.ready
    await executor.refresh_preflight()
    assert client.object_info.await_count == 1
    clock[0] += 5
    await executor.refresh_preflight()
    assert executor.ready
    assert executor.readiness_error == ""
    assert client.object_info.await_count == 2
    assert verification == [tmp_path], "Transient health failure must not rehash pinned model files"
    client.submit_prompt.assert_not_awaited()


async def test_readiness_refresh_keeps_invalid_static_profile_blocked(monkeypatch, tmp_path):
    from narrativex_gpu_worker.adapters.executors.ltx import executor as module
    from narrativex_gpu_worker.adapters.executors.ltx.executor import LtxVideoExecutor

    def reject(_path):
        raise ValueError("Pinned model revision mismatch")

    monkeypatch.setattr(module, "verify_runtime_files", reject)
    client = AsyncMock()
    executor = LtxVideoExecutor(client, AsyncMock(), runtime_directory=tmp_path)
    await executor.preflight()
    assert not executor.ready
    assert "revision mismatch" in executor.readiness_error
    await executor.refresh_preflight()
    client.object_info.assert_not_awaited()
    client.submit_prompt.assert_not_awaited()


def info_for_graph(graph):
    info = {}
    for node in graph.values():
        class_type = node["class_type"]
        if class_type not in info:
            info[class_type] = {
                "output": MANIFEST["outputs"][class_type],
                "input": {"required": {}},
            }
        req_ports = info[class_type]["input"]["required"]
        for name, value in node["inputs"].items():
            if name in {"vae_name", "unet_name", "clip_name"}:
                if name not in req_ports:
                    req_ports[name] = [[value]]
                elif value not in req_ports[name][0]:
                    req_ports[name][0].append(value)
            elif isinstance(value, list):
                outputs = MANIFEST["outputs"][graph[value[0]]["class_type"]]
                req_ports[name] = [outputs[value[1]]]
            else:
                req_ports[name] = [
                    "INT"
                    if isinstance(value, int)
                    else "FLOAT"
                    if isinstance(value, float)
                    else "STRING"
                ]
    return info


def test_preflight_rejects_wrong_connection_type_and_loader_inventory():
    graph = baseline_graph()
    info = info_for_graph(graph)
    validate_object_info(info, graph)
    changed = deepcopy(info)
    changed["CreateVideo"]["input"]["required"]["audio"] = ["IMAGE"]
    with pytest.raises(ValueError, match="connection"):
        validate_object_info(changed, graph)
    info["UNETLoader"]["input"]["required"]["unet_name"] = [["wrong.safetensors"]]
    with pytest.raises(ValueError, match="loader"):
        validate_object_info(info, graph)


def test_savevideo_dynamic_combo_requires_verified_flat_codec_port():
    graph = baseline_graph()
    assert graph["4852"]["inputs"]["format.codec"] == "auto"
    info = info_for_graph(graph)
    info["SaveVideo"]["input"]["required"] = {
        "video": ["VIDEO"],
        "filename_prefix": ["STRING"],
        "format": [
            "COMFY_DYNAMICCOMBO_V3",
            {
                "options": [
                    {
                        "key": "mp4",
                        "inputs": {
                            "required": {
                                "codec": [
                                    "COMFY_DYNAMICCOMBO_V3",
                                    {"options": [{"key": "auto", "inputs": {}}]},
                                ]
                            }
                        },
                    }
                ]
            },
        ],
    }
    validate_object_info(info, graph)
    info["SaveVideo"]["input"]["required"]["format"][1]["options"] = []
    with pytest.raises(ValueError):
        validate_object_info(info, graph)
