"""Workflow builder for LTX-2.5 moving video generation."""
from __future__ import annotations

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
                dlg_lines.append(f'{speaker + ": " if speaker else ""}"{text}"')
        if dlg_lines:
            parts.append(f"[Dialogue: {' | '.join(dlg_lines)}]")

    if voice_reference is not None:
        voice_hints: list[str] = []
        if getattr(voice_reference, "voice_description", None):
            voice_hints.append(f"tone: {voice_reference.voice_description}")
        if getattr(voice_reference, "delivery_baseline", None):
            voice_hints.append(f"delivery: {voice_reference.delivery_baseline}")
        if voice_hints:
            parts.append(f"[Voice Identity: {', '.join(voice_hints)}]")

    return " -- ".join(parts) if len(parts) > 1 else parts[0]


SUPPORTED_STRATEGIES = frozenset({"TEXT_TO_VIDEO", "IMAGE_TO_VIDEO", "FIRST_LAST_FRAME"})
UNSUPPORTED_STRATEGIES = frozenset({"MULTI_KEYFRAME", "VIDEO_EXTEND", "VIDEO_RETAKE"})


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
    steps: int = 30,
    cfg: float = 3.0,
    filename_prefix: str = "NarrativeX_Shot",
    start_image: str | None = None,
    end_image: str | None = None,
    voice_audio: str | None = None,
) -> dict[str, Any]:
    """Construct LTX-2.5 audio-native video generation workflow graph
    with rich semantic conditioning.
    """
    if generation_mode in UNSUPPORTED_STRATEGIES:
        raise ValueError(f"Unsupported generation strategy: {generation_mode}")

    neg = negative_prompt or DEFAULT_NEGATIVE_PROMPT
    frame_count = max(16, int(round((duration_ms / 1000.0) * fps)))

    enriched_prompt = compose_ltx_positive_prompt(
        base_prompt=prompt,
        dialogue=dialogue,
        camera_intent=camera_intent,
        motion_intent=motion_intent,
        voice_reference=voice_reference,
    )

    ckpt_file = checkpoint if checkpoint.endswith(".safetensors") else f"{checkpoint}.safetensors"

    options = provider_options or {}
    effective_steps = int(options.get("steps", steps))
    effective_cfg = float(options.get("cfg", cfg))
    sampler_name = str(options.get("sampler_name", "euler"))
    scheduler = str(options.get("scheduler", "normal"))

    workflow: dict[str, Any] = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": ckpt_file},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": enriched_prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": neg, "clip": ["1", 1]},
        },
    }

    # Strategy-specific video latent preparation
    if generation_mode == "IMAGE_TO_VIDEO":
        if not start_image:
            raise ValueError("IMAGE_TO_VIDEO requires start_image")
        workflow["8"] = {
            "class_type": "LoadImage",
            "inputs": {"image": start_image},
        }
        workflow["4"] = {
            "class_type": "LTXImageToVideo",
            "inputs": {
                "image": ["8", 0],
                "vae": ["1", 2],
                "width": width,
                "height": height,
                "length": frame_count,
            },
        }
    elif generation_mode == "FIRST_LAST_FRAME":
        if not start_image or not end_image:
            raise ValueError("FIRST_LAST_FRAME requires both start_image and end_image")
        workflow["8"] = {
            "class_type": "LoadImage",
            "inputs": {"image": start_image},
        }
        workflow["9"] = {
            "class_type": "LoadImage",
            "inputs": {"image": end_image},
        }
        workflow["4"] = {
            "class_type": "LTXFirstLastFrame",
            "inputs": {
                "start_image": ["8", 0],
                "end_image": ["9", 0],
                "vae": ["1", 2],
                "width": width,
                "height": height,
                "length": frame_count,
            },
        }
    else:  # TEXT_TO_VIDEO or default
        workflow["4"] = {
            "class_type": "EmptyLatentVideo",
            "inputs": {
                "width": width,
                "height": height,
                "length": frame_count,
                "batch_size": 1,
            },
        }

    # KSampler with A/V diffusion conditioning
    workflow["5"] = {
        "class_type": "KSampler",
        "inputs": {
            "seed": seed,
            "steps": effective_steps,
            "cfg": effective_cfg,
            "sampler_name": sampler_name,
            "scheduler": scheduler,
            "denoise": 1.0,
            "model": ["1", 0],
            "positive": ["2", 0],
            "negative": ["3", 0],
            "latent_image": ["4", 0],
        },
    }

    # VAE Decode
    workflow["6"] = {
        "class_type": "VAEDecode",
        "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
    }

    # SaveVideo with synchronized audio muxing
    save_inputs: dict[str, Any] = {
        "images": ["6", 0],
        "filename_prefix": filename_prefix,
        "fps": fps,
        "format": "video/mp4",
        "codec": "h264",
    }

    # Audio conditioning via voice reference
    if voice_audio:
        workflow["11"] = {
            "class_type": "LoadAudio",
            "inputs": {"audio": voice_audio},
        }
        workflow["12"] = {
            "class_type": "LTXAudioConditioning",
            "inputs": {"audio": ["11", 0], "vae": ["1", 2]},
        }
        save_inputs["audio"] = ["11", 0]

    workflow["7"] = {
        "class_type": "SaveVideo",
        "inputs": save_inputs,
    }

    return workflow
