"""Pinned-schema mocked preflight, never a GPU readiness claim."""

from copy import deepcopy

import pytest

from narrativex_gpu_worker.adapters.executors.ltx.preflight import (
    baseline_graph,
    validate_object_info,
)
from narrativex_gpu_worker.adapters.executors.ltx.workflow import MANIFEST


def info_for_graph(graph):
    info = {}
    for node in graph.values():
        ports = {}
        for name, value in node["inputs"].items():
            if isinstance(value, list):
                outputs = MANIFEST["outputs"][graph[value[0]]["class_type"]]
                ports[name] = [outputs[value[1]]]
            else:
                ports[name] = [
                    "INT"
                    if isinstance(value, int)
                    else "FLOAT"
                    if isinstance(value, float)
                    else "STRING"
                ]
            if name in {"vae_name", "unet_name", "clip_name"}:
                ports[name] = [[value]]
        info[node["class_type"]] = {
            "output": MANIFEST["outputs"][node["class_type"]],
            "input": {"required": ports},
        }
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
