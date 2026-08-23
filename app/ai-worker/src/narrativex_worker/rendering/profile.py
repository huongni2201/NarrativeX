"""Immutable renderer profile pinned by the backend at render admission."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.rendering.effects import RenderEffects


@dataclass(frozen=True)
class RenderProfile:
    schema_version: int
    engine: str
    renderer_version: str
    fps: int
    video_encoder: str
    x264_preset: str
    crf: int
    nvenc_preset: str
    nvenc_cq: int
    pixel_format: str
    audio_codec: str
    audio_bitrate: str
    audio_sample_rate: int
    effects: RenderEffects
    subtitle_mode: str

    @classmethod
    def from_json(cls, raw: str | Mapping[str, Any]) -> RenderProfile:
        payload: Mapping[str, Any]
        if isinstance(raw, str):
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError("render profile must be a JSON object")
            payload = parsed
        else:
            payload = raw

        video = _object(payload, "video")
        audio = _object(payload, "audio")
        effect_payload = _object(payload, "effects")
        subtitles = _object(payload, "subtitles")

        if any(
            effect_payload.get(key) is not None
            for key in ("lutAsset", "overlayAsset", "watermarkAsset", "bgmAsset")
        ):
            raise ValueError("render profile contains external effects that are not pinned yet")
        if effect_payload.get("textOverlays", []) != []:
            raise ValueError("render profile text overlays are not pinned yet")

        profile = cls(
            schema_version=int(payload["schemaVersion"]),
            engine=str(payload["engine"]),
            renderer_version=str(payload["rendererVersion"]),
            fps=int(payload["fps"]),
            video_encoder=str(video["encoder"]),
            x264_preset=str(video["x264Preset"]),
            crf=int(video["crf"]),
            nvenc_preset=str(video["nvencPreset"]),
            nvenc_cq=int(video["nvencCq"]),
            pixel_format=str(video["pixelFormat"]),
            audio_codec=str(audio["codec"]),
            audio_bitrate=str(audio["bitrate"]),
            audio_sample_rate=int(audio["sampleRate"]),
            effects=RenderEffects(
                transition=str(effect_payload["transition"]),
                transition_seconds=float(effect_payload["transitionSeconds"]),
                color_grade=str(effect_payload["colorGrade"]),
                background_mode=str(effect_payload["backgroundMode"]),
                background_blur_sigma=float(effect_payload["backgroundBlurSigma"]),
                overlay_style=str(effect_payload["overlayStyle"]),
                overlay_opacity=float(effect_payload["overlayOpacity"]),
                watermark_width_ratio=float(effect_payload["watermarkWidthRatio"]),
                watermark_opacity=float(effect_payload["watermarkOpacity"]),
                watermark_position=str(effect_payload["watermarkPosition"]),
                bgm_volume=float(effect_payload["bgmVolume"]),
                duck_threshold=float(effect_payload["duckThreshold"]),
                duck_ratio=float(effect_payload["duckRatio"]),
                duck_attack_ms=float(effect_payload["duckAttackMs"]),
                duck_release_ms=float(effect_payload["duckReleaseMs"]),
                motion_easing=str(effect_payload["motionEasing"]),
            ),
            subtitle_mode=str(subtitles["mode"]),
        )
        profile.validate()
        return profile

    def validate(self) -> None:
        if self.schema_version != 1:
            raise ValueError(f"unsupported render profile schema: {self.schema_version}")
        if self.engine != "ffmpeg-python":
            raise ValueError(f"unsupported render engine: {self.engine}")
        if not self.renderer_version.strip():
            raise ValueError("rendererVersion must not be blank")
        if self.fps <= 0:
            raise ValueError("render profile fps must be positive")
        if self.video_encoder not in {"libx264", "h264_nvenc"}:
            raise ValueError(f"unsupported pinned encoder: {self.video_encoder}")
        if self.pixel_format != "yuv420p":
            raise ValueError(f"unsupported pixel format: {self.pixel_format}")
        if self.audio_codec != "aac" or self.audio_sample_rate != 48000:
            raise ValueError("unsupported pinned audio encoding")
        if self.subtitle_mode != "burned-ass":
            raise ValueError(f"unsupported subtitle mode: {self.subtitle_mode}")
        self.effects.validate()

    def fingerprint_payload(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "engine": self.engine,
            "rendererVersion": self.renderer_version,
            "fps": self.fps,
            "video": {
                "encoder": self.video_encoder,
                "x264Preset": self.x264_preset,
                "crf": self.crf,
                "nvencPreset": self.nvenc_preset,
                "nvencCq": self.nvenc_cq,
                "pixelFormat": self.pixel_format,
            },
            "audio": {
                "codec": self.audio_codec,
                "bitrate": self.audio_bitrate,
                "sampleRate": self.audio_sample_rate,
            },
            "effects": {
                "transition": self.effects.transition,
                "transitionSeconds": self.effects.transition_seconds,
                "colorGrade": self.effects.color_grade,
                "backgroundMode": self.effects.background_mode,
                "backgroundBlurSigma": self.effects.background_blur_sigma,
                "overlayStyle": self.effects.overlay_style,
                "overlayOpacity": self.effects.overlay_opacity,
                "watermarkWidthRatio": self.effects.watermark_width_ratio,
                "watermarkOpacity": self.effects.watermark_opacity,
                "watermarkPosition": self.effects.watermark_position,
                "bgmVolume": self.effects.bgm_volume,
                "duckThreshold": self.effects.duck_threshold,
                "duckRatio": self.effects.duck_ratio,
                "duckAttackMs": self.effects.duck_attack_ms,
                "duckReleaseMs": self.effects.duck_release_ms,
                "motionEasing": self.effects.motion_easing,
                "textOverlays": [],
                "lutAsset": None,
                "overlayAsset": None,
                "watermarkAsset": None,
                "bgmAsset": None,
            },
            "subtitles": {"mode": self.subtitle_mode},
        }


async def load_render_profile(database_url: str, generation_job_id: UUID) -> RenderProfile:
    connection = await asyncpg.connect(database_url)
    try:
        raw = await connection.fetchval(
            "SELECT render_profile_json FROM render_input_snapshots WHERE generation_job_id = $1",
            generation_job_id,
        )
    finally:
        await connection.close()
    if raw is None:
        raise ValueError("render input snapshot is missing its pinned render profile")
    return RenderProfile.from_json(raw)


def _object(payload: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"render profile {key} must be an object")
    return value
