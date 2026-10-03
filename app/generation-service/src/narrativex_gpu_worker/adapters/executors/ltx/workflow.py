"""Workflow builder for LTX-2.5 moving video generation."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, morphing, unnatural limbs, jittery motion, abrupt camera jump, "
    "deformed facial features, plastic skin, 2D flat cel animation, flickering, visual noise, "
    "text, watermark"
)


def compose_ltx_positive_prompt(
    base_prompt: str,
    dialogue: list[Any] | None = None,
    camera_intent: Any | None = None,
    motion_intent: Any | None = None,
    voice_reference: Any | None = None,
) -> str:
    """Enrich the video generation prompt with structured cinematic and audio conditioning."""
    parts = [base_prompt.strip()]

    if camera_intent is not None:
        cam_elements: list[str] = []
        if getattr(camera_intent, "framing", None):
            cam_elements.append(f"framing: {camera_intent.framing}")
        if getattr(camera_intent, "movement", None):
            cam_elements.append(f"camera movement: {camera_intent.movement}")
        if getattr(camera_intent, "angle", None):
            cam_elements.append(f"camera angle: {camera_intent.angle}")
        if getattr(camera_intent, "speed", None):
            cam_elements.append(f"camera speed: {camera_intent.speed}")
        if cam_elements:
            parts.append(f"[Cinematography: {', '.join(cam_elements)}]")

    if motion_intent is not None:
        mot_elements: list[str] = []
        if getattr(motion_intent, "subject_motion", None):
            mot_elements.append(f"action: {motion_intent.subject_motion}")
        if getattr(motion_intent, "speed", None):
            mot_elements.append(f"motion speed: {motion_intent.speed}")
        if getattr(motion_intent, "dynamics", None):
            mot_elements.append(f"dynamics: {motion_intent.dynamics}")
        if mot_elements:
            parts.append(f"[Motion: {', '.join(mot_elements)}]")

    if dialogue:
        dlg_lines: list[str] = []
        for line in dialogue:
            speaker = getattr(line, "speaker", None)
            text = getattr(line, "text", "")
            if text:
                description = getattr(line, "voice_description", None)
                voice = f" (voice: {description})" if description else ""
                dlg_lines.append(f'{speaker + voice + ": " if speaker else ""}"{text}"')
        if dlg_lines:
            parts.append(f"[Dialogue: {' | '.join(dlg_lines)}]")

    if voice_reference is not None:
        voice_hints: list[str] = []
        if getattr(voice_reference, "voice_description", None):
            voice_hints.append(f"tone: {voice_reference.voice_description}")
        if getattr(voice_reference, "delivery_baseline", None):
            voice_hints.append(f"delivery: {voice_reference.delivery_baseline}")
        if getattr(voice_reference, "language", None):
            voice_hints.append(f"language: {voice_reference.language}")
        if getattr(voice_reference, "accent", None):
            voice_hints.append(f"accent: {voice_reference.accent}")
        if voice_hints:
            parts.append(f"[Voice Identity: {', '.join(voice_hints)}]")

    return " -- ".join(parts) if len(parts) > 1 else parts[0]


SUPPORTED_STRATEGIES = frozenset({"TEXT_TO_VIDEO"})
UNSUPPORTED_STRATEGIES = frozenset(
    {"IMAGE_TO_VIDEO", "FIRST_LAST_FRAME", "MULTI_KEYFRAME", "VIDEO_EXTEND", "VIDEO_RETAKE"}
)
WORKFLOWS = Path(__file__).with_name("workflows")
MANIFEST: dict[str, Any] = json.loads((WORKFLOWS / "native-av.manifest.json").read_text())
PROFILE_ID: str = MANIFEST["profileId"]
CHECKPOINT = "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors"


def build_ltx_video_workflow(
    prompt: str,
    negative_prompt: str | None,
    checkpoint: str,
    width: int,
    height: int,
    fps: int,
    duration_ms: int,
    seed: int,
    generation_mode: str = "TEXT_TO_VIDEO",
    motion_bucket_id: int | None = None,
    dialogue: list[Any] | None = None,
    camera_intent: Any | None = None,
    motion_intent: Any | None = None,
    voice_reference: Any | None = None,
    provider_options: dict[str, Any] | None = None,
    start_image: str | None = None,
    end_image: str | None = None,
    voice_audio: str | None = None,
) -> dict[str, Any]:
    """Bind the allowlisted T2V profile; never accept caller-supplied graphs or models."""
    if generation_mode not in SUPPORTED_STRATEGIES:
        raise ValueError(f"Unsupported generation strategy: {generation_mode}")
    if voice_audio:
        raise ValueError("Audio reference conditioning is not verified for this profile")
    if start_image or end_image:
        raise ValueError("Image conditioning is not verified for this profile")
    if checkpoint != CHECKPOINT:
        raise ValueError("Checkpoint does not match the pinned workflow profile")
    if provider_options or motion_bucket_id is not None:
        raise ValueError("Provider controls are not supported by the pinned profile")
    if (width, height, fps) != (1280, 720, 24) or not 100 <= duration_ms <= 10000:
        raise ValueError("Native profile requires 1280x720, 24 FPS, and at most 10 seconds")
    if not 0 <= seed <= 18446744073709551615:
        raise ValueError("Seed must be an unsigned 64-bit integer")
    raw = (WORKFLOWS / "native-av.json").read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST["graphSha256"]:
        raise ValueError("Pinned workflow digest mismatch")
    workflow: dict[str, Any] = json.loads(raw)
    frames = 1 + (duration_ms * fps // 8000) * 8
    workflow["2612"]["inputs"]["text"] = compose_ltx_positive_prompt(
        prompt, dialogue, camera_intent, motion_intent, voice_reference
    )
    workflow["2483"]["inputs"]["text"] = negative_prompt or DEFAULT_NEGATIVE_PROMPT
    workflow["3059"]["inputs"]["length"] = frames
    workflow["3980"]["inputs"]["frames_number"] = frames
    workflow["4832"]["inputs"]["noise_seed"] = seed
    # The output prefix is internal and cannot be a caller-supplied machine path.
    return workflow
