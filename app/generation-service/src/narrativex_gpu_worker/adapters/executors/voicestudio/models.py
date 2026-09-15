from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VoiceStudioSpeechRequest:
    text: str
    voice: str
    language: str | None = None
    speed: float = 1.0
