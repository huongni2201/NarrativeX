from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VieNeuSpeechRequest:
    text: str
    voice: str
    speed: float = 1.0
    temperature: float = 0.7
