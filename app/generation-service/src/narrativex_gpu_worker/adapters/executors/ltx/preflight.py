"""Read-only native profile preflight. No prompts or model loads are submitted."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from typing import Any

from .workflow import CHECKPOINT, MANIFEST, build_ltx_video_workflow


def validate_object_info(info: dict[str, Any], graph: dict[str, Any]) -> None:
    for node in graph.values():
        kind = node["class_type"]
        schema = info.get(kind)
        if not isinstance(schema, dict) or schema.get("output") != MANIFEST["outputs"][kind]:
            raise ValueError(f"Runtime output schema mismatch: {kind}")
        inputs = schema.get("input", {})
        ports = inputs.get("required", {}) | inputs.get("optional", {})
        if kind == "SaveVideo" and ports.get("format", [None])[0] == "COMFY_DYNAMICCOMBO_V3":
            formats = ports["format"][1].get("options", [])
            mp4 = next((option for option in formats if option["key"] == "mp4"), None)
            if mp4 is None:
                raise ValueError("Pinned SaveVideo mp4 format unavailable")
            codec = mp4.get("inputs", {}).get("required", {}).get("codec")
            if not codec or codec[0] != "COMFY_DYNAMICCOMBO_V3":
                raise ValueError("Pinned SaveVideo codec schema mismatch")
            if not any(option["key"] == "auto" for option in codec[1].get("options", [])):
                raise ValueError("Pinned SaveVideo auto codec unavailable")
            ports["format"] = [["mp4"]]
            ports["format.codec"] = [["auto"]]
        if set(inputs.get("required", {})) - node["inputs"].keys():
            raise ValueError(f"Required runtime input missing: {kind}")
        for name, value in node["inputs"].items():
            if name not in ports:
                raise ValueError(f"Runtime port missing: {kind}.{name}")
            spec = ports[name]
            expected = spec[0]
            if (
                kind in {"VAELoader", "UNETLoader", "CLIPLoader"}
                and name in {"vae_name", "unet_name", "clip_name"}
                and not isinstance(expected, list)
            ):
                raise ValueError(f"Runtime loader inventory missing: {kind}.{name}")
            if isinstance(value, list):
                source = graph[value[0]]["class_type"]
                actual = MANIFEST["outputs"][source][value[1]]
                if actual != expected:
                    raise ValueError(f"Runtime connection type mismatch: {kind}.{name}")
            elif isinstance(expected, list):
                if value not in expected:
                    raise ValueError(f"Runtime loader/enum mismatch: {kind}.{name}")
            elif expected in {"INT", "FLOAT", "FLOAT,INT"}:
                if not isinstance(value, (int, float)) or isinstance(value, bool):
                    raise ValueError(f"Runtime numeric type mismatch: {kind}.{name}")
                if expected == "INT" and not isinstance(value, int):
                    raise ValueError(f"Runtime integer type mismatch: {kind}.{name}")
                limits = spec[1] if len(spec) > 1 else {}
                if value < limits.get("min", value) or value > limits.get("max", value):
                    raise ValueError(f"Runtime numeric range mismatch: {kind}.{name}")
            elif expected == "STRING":
                if not isinstance(value, str):
                    raise ValueError(f"Runtime string type mismatch: {kind}.{name}")
            else:
                raise ValueError(f"Unverified runtime input schema: {kind}.{name}: {expected}")


def verify_runtime_files(runtime: Path) -> None:
    commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=runtime, text=True, timeout=10
    ).strip()
    dirty = subprocess.check_output(
        ["git", "status", "--porcelain", "--untracked-files=no"],
        cwd=runtime,
        text=True,
        timeout=10,
    ).strip()
    if commit != MANIFEST["runtimeCommit"] or dirty:
        raise ValueError("ComfyUI runtime pin mismatch or modified source")
    for model in MANIFEST["models"]:
        file = runtime / "models" / model["path"]
        if not file.is_file() or file.stat().st_size != model["sizeBytes"]:
            raise ValueError(f"Pinned model missing or wrong size: {model['path']}")
        with file.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != model["sha256"]:
            raise ValueError(f"Pinned model checksum mismatch: {model['path']}")


def baseline_graph() -> dict[str, Any]:
    return build_ltx_video_workflow("preflight", "", CHECKPOINT, 1280, 720, 24, 3000, 0)
