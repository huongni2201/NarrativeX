package com.narrativex.backend.feature.generation.domain.enums;

/** States whether provider token telemetry was actually supplied for a completed run. */
public enum ChapterAnalysisUsageState {
  REPORTED,
  PARTIAL,
  UNKNOWN,
  LEGACY_UNSPECIFIED;
}
