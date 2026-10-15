package com.narrativex.backend.feature.generation.domain.enums;

public enum ChapterAnalysisExecutionMode {
  VERTEX_API,
  /** Retired local CLI runner. Kept so historical snapshots and runs stay readable. */
  ANTIGRAVITY_CLI,
  /** Desktop-owned Google OAuth sessions calling the Antigravity API. */
  ANTIGRAVITY_API
}
