"""Static graph regressions; these do not establish GPU runtime readiness."""

from __future__ import annotations

import pytest

from narrativex_gpu_worker.adapters.executors.ltx.workflow import build_ltx_video_workflow

CHECKPOINT = "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors"


def graph(**changes):
    return build_ltx_video_workflow(
        **{
            "prompt": "A woman says the approved line in a quiet courtyard",
            "negative_prompt": None,
            "checkpoint": CHECKPOINT,
            "width": 1280,
            "height": 720,
            "fps": 24,
            "duration_ms": 3000,
            "seed": 123,
        }
        | changes
    )


def test_saved_video_uses_joint_generated_audio_and_video():
    workflow = graph()
    save = next(n for n in workflow.values() if n["class_type"] == "SaveVideo")
    video = workflow[save["inputs"]["video"][0]]
    assert video["class_type"] == "CreateVideo"
    audio = workflow[video["inputs"]["audio"][0]]
    assert audio["class_type"] == "LTXVAudioVAEDecode"
    separated = workflow[audio["inputs"]["samples"][0]]
    assert separated["class_type"] == "LTXVSeparateAVLatent"
    sampler = workflow[separated["inputs"]["av_latent"][0]]
    assert sampler["class_type"] == "SamplerCustomAdvanced"
    joined = workflow[sampler["inputs"]["latent_image"][0]]
    assert joined["class_type"] == "LTXVConcatAVLatent"


def test_frame_count_preserves_official_eight_plus_one_constraint():
    workflow = graph()
    video = next(n for n in workflow.values() if n["class_type"] == "EmptyLTXVLatentVideo")
    audio = next(n for n in workflow.values() if n["class_type"] == "LTXVEmptyLatentAudio")
    assert video["inputs"]["length"] == 73
    assert audio["inputs"]["frames_number"] == 73


def test_voice_reference_cannot_replace_generated_dialogue_audio():
    with pytest.raises(ValueError, match="conditioning"):
        graph(voice_audio="reference.wav")
