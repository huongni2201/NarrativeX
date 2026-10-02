package com.narrativex.backend.feature.generation.domain.enums;

/**
 * Clock source defining master timing for assembling the edit decision list and video renders. In
 * video-first and audio-native production, GENERATED_TAKE_AUDIO and SCRIPT_LOCK govern the timing
 * authoritative pipeline according to ADR-0030.
 */
public enum AudioClockSource {
  GENERATED_TAKE_AUDIO,
  SCRIPT_LOCK,
  EXTERNAL_MASTER,
  TTS_FALLBACK,
  VIENEU_MASTER
}
