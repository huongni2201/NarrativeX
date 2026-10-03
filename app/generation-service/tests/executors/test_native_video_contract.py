from copy import deepcopy

import pytest
from pydantic import ValidationError

from conftest import task_payload
from narrativex_gpu_worker.contracts import ComputeTask


def native_payload():
    payload = task_payload()
    payload["task"] = {"type": "video.generate", "schemaVersion": "1.1"}
    payload["model"] = {
        "executor": "ltx",
        "model": "ltx-2.5-22b-distilled-int8",
        "revision": "5e6e71018ee1756ed329b697a7b4aedc934dfce9",
    }
    payload["inputs"] = {
        "workflowProfileId": "ltx-2.5-22b-distilled-int8-native-av-v1",
        "audioMode": "NATIVE_AV",
        "prompt": "Courtyard dialogue",
        "negativePrompt": "",
        "width": 1280,
        "height": 720,
        "fps": 24,
        "durationMs": 3000,
        "generationMode": "TEXT_TO_VIDEO",
        "seed": 42,
        "dialogue": [
            {
                "speaker": "Narrator",
                "text": "Exact approved line",
                "voiceDescription": "Older warm Vietnamese voice",
            }
        ],
        "voiceReference": {"voiceDescription": "Warm", "accent": "Northern Vietnamese"},
    }
    return payload


def test_closed_native_contract_and_schema_version_binding():
    payload = native_payload()
    ComputeTask.model_validate(payload)
    for key, value in [
        ("projectId", "id"),
        ("referenceAssetIds", []),
        ("providerOptions", {}),
        ("path", "C:/weights"),
    ]:
        changed = deepcopy(payload)
        changed["inputs"][key] = value
        with pytest.raises(ValidationError):
            ComputeTask.model_validate(changed)
    for nested, key in [("voiceReference", "assetId"), ("cameraIntent", "path")]:
        changed = deepcopy(payload)
        changed["inputs"].setdefault(nested, {})[key] = "forbidden"
        with pytest.raises(ValidationError):
            ComputeTask.model_validate(changed)
    payload["task"]["schemaVersion"] = "1.0"
    with pytest.raises(ValidationError):
        ComputeTask.model_validate(payload)
