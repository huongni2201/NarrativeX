from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

TRANSITION_CATALOG: dict[str, str | None] = {
    "CUT": None,
    "FADE": "fade",
    "DISSOLVE": "dissolve",
    "SLIDE_LEFT": "slideleft",
    "SLIDE_RIGHT": "slideright",
    "SLIDE_UP": "slideup",
    "SLIDE_DOWN": "slidedown",
    "ZOOM": "zoomin",
    "WIPE_LEFT": "wipeleft",
    "WIPE_RIGHT": "wiperight",
    "WIPE_UP": "wipeup",
    "WIPE_DOWN": "wipedown",
}
AUTO_TRANSITIONS = ("DISSOLVE", "SLIDE_LEFT", "ZOOM", "WIPE_LEFT", "FADE")
COLOR_GRADES = {"NONE", "CINEMATIC", "WARM", "COOL", "HORROR", "FANTASY"}
BACKGROUND_MODES = {"COVER", "BLUR", "AUTO"}
OVERLAY_STYLES = {"NONE", "FILM_GRAIN", "VIGNETTE", "FILM_GRAIN_VIGNETTE"}
MOTION_EASINGS = {"LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"}
TEXT_STYLES = {"FADE", "SLIDE", "POP", "TYPEWRITER"}
TEXT_POSITIONS = {"TOP", "CENTER", "BOTTOM"}
WATERMARK_POSITIONS = {"TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT", "CENTER"}


@dataclass(frozen=True)
class AnimatedText:
    text: str
    start_seconds: float
    end_seconds: float
    style: str = "FADE"
    position: str = "BOTTOM"
    font_size: int = 56
    font_color: str = "white"
    box: bool = True


@dataclass(frozen=True)
class RenderEffects:
    # LEGACY_FADE preserves the render behavior that existed before the effect catalog.
    transition: str = "LEGACY_FADE"
    transition_seconds: float = 0.12
    color_grade: str = "NONE"
    lut_path: Path | None = None
    background_mode: str = "COVER"
    background_blur_sigma: float = 22.0
    overlay_style: str = "NONE"
    overlay_path: Path | None = None
    overlay_opacity: float = 0.30
    watermark_path: Path | None = None
    watermark_width_ratio: float = 0.12
    watermark_opacity: float = 0.82
    watermark_position: str = "TOP_RIGHT"
    bgm_path: Path | None = None
    bgm_volume: float = 0.18
    duck_threshold: float = 0.08
    duck_ratio: float = 8.0
    duck_attack_ms: float = 20.0
    duck_release_ms: float = 350.0
    motion_easing: str = "LINEAR"
    text_overlays: tuple[AnimatedText, ...] = ()

    @classmethod
    def cinematic(cls) -> "RenderEffects":
        return cls(
            transition="AUTO",
            transition_seconds=0.25,
            color_grade="CINEMATIC",
            background_mode="AUTO",
            overlay_style="VIGNETTE",
            motion_easing="EASE_IN_OUT",
        )

    def validate(self) -> None:
        if self.transition not in {"AUTO", "LEGACY_FADE", *TRANSITION_CATALOG}:
            raise ValueError(f"unsupported transition: {self.transition}")
        if not 0 <= self.transition_seconds <= 2:
            raise ValueError("transition_seconds must be between 0 and 2")
        if self.color_grade not in COLOR_GRADES:
            raise ValueError(f"unsupported color grade: {self.color_grade}")
        if self.background_mode not in BACKGROUND_MODES:
            raise ValueError(f"unsupported background mode: {self.background_mode}")
        if not 0 <= self.background_blur_sigma <= 100:
            raise ValueError("background_blur_sigma must be between 0 and 100")
        if self.overlay_style not in OVERLAY_STYLES:
            raise ValueError(f"unsupported overlay style: {self.overlay_style}")
        if not 0 <= self.overlay_opacity <= 1:
            raise ValueError("overlay_opacity must be between 0 and 1")
        if not 0.02 <= self.watermark_width_ratio <= 0.5:
            raise ValueError("watermark_width_ratio must be between 0.02 and 0.5")
        if not 0 <= self.watermark_opacity <= 1:
            raise ValueError("watermark_opacity must be between 0 and 1")
        if self.watermark_position not in WATERMARK_POSITIONS:
            raise ValueError(f"unsupported watermark position: {self.watermark_position}")
        if not 0 <= self.bgm_volume <= 1:
            raise ValueError("bgm_volume must be between 0 and 1")
        if not 0.00097563 <= self.duck_threshold <= 1:
            raise ValueError("duck_threshold is outside FFmpeg sidechaincompress range")
        if not 1 <= self.duck_ratio <= 20:
            raise ValueError("duck_ratio must be between 1 and 20")
        if self.motion_easing not in MOTION_EASINGS:
            raise ValueError(f"unsupported motion easing: {self.motion_easing}")
        if self.lut_path is not None and self.lut_path.suffix.lower() not in {
            ".cube",
            ".3dl",
            ".dat",
            ".m3d",
            ".csp",
        }:
            raise ValueError("unsupported LUT file format")
        for item in self.text_overlays:
            if not item.text.strip():
                raise ValueError("animated text must not be blank")
            if item.start_seconds < 0 or item.end_seconds <= item.start_seconds:
                raise ValueError("animated text timing is invalid")
            if item.style not in TEXT_STYLES:
                raise ValueError(f"unsupported animated text style: {item.style}")
            if item.position not in TEXT_POSITIONS:
                raise ValueError(f"unsupported animated text position: {item.position}")
            if not 8 <= item.font_size <= 240:
                raise ValueError("animated text font_size must be between 8 and 240")
