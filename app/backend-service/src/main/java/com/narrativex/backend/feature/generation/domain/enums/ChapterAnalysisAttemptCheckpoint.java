package com.narrativex.backend.feature.generation.domain.enums;

public enum ChapterAnalysisAttemptCheckpoint {
  CLAIMED,
  SUBMITTING,
  LOCAL_RUNNING,
  RESULT_READY,
  DELIVERED,
  REJECTED_BEFORE_EXECUTION,
  FAILED,
  CANCELED,
  UNKNOWN
}
