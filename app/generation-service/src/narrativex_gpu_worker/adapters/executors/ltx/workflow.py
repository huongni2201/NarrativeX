"""Workflow builder for LTX-2.5 moving video generation."""
from __future__ import annotations

from typing import Any

DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, morphing, unnatural limbs, jittery motion, abrupt camera jump, "
    "deformed facial features, plastic skin, 2D flat cel animation, flickering, visual noise, "
    "text, watermark"
)


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
    steps: int = 30,
    cfg: float = 3.0,
    filename_prefix: str = "NarrativeX_Shot",
) -> dict[str, Any]:
    """Construct LTX-2.5 video generation workflow graph."""
    neg = negative_prompt or DEFAULT_NEGATIVE_PROMPT
    frame_count = max(16, int(round((duration_ms / 1000.0) * fps)))

    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": checkpoint},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": neg, "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentVideo",
            "inputs": {
                "width": width,
                "height": height,
                "length": frame_count,
                "batch_size": 1,
            },
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
        },
        "7": {
            "class_type": "SaveVideo",
            "inputs": {
                "images": ["6", 0],
                "filename_prefix": filename_prefix,
                "fps": fps,
                "format": "video/mp4",
                "codec": "h264",
            },
        },
    }
