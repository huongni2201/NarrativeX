package com.narrativex.backend.feature.generation.domain.enums;

public enum JobStatus {
  QUEUED,
  RUNNING,
  COMPLETED,
  FAILED,
  CANCELED,
  UNKNOWN,
  STALLED,
  PAUSED_COST_LIMIT
}
