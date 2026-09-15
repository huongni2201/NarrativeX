from __future__ import annotations

from typing import Any

DEFAULT_NEGATIVE_PROMPT = (
    "text, watermark, logo, signature, low quality, blurry, deformed, bad anatomy, "
    "extra fingers, extra limbs"
)


def build_txt2img_workflow(
    prompt: str,
    negative_prompt: str | None,
    checkpoint: str,
    width: int,
    height: int,
    seed: int,
    filename_prefix: str = "NarrativeX",
    steps: int = 28,
    cfg: float = 5.5,
    sampler_name: str = "dpmpp_2m_sde",
    scheduler: str = "karras",
) -> dict[str, Any]:
    """Construct standard ComfyUI txt2img workflow graph."""
    neg = negative_prompt or DEFAULT_NEGATIVE_PROMPT
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": neg, "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": sampler_name,
                "scheduler": scheduler,
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
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": filename_prefix, "images": ["6", 0]},
        },
    }


__all__ = ["DEFAULT_NEGATIVE_PROMPT", "build_txt2img_workflow"]
