package com.narrativex.backend.feature.generation.domain.enums;

public enum JobStatus {
  QUEUED,
  SUBMITTING,
  SUBMITTED,
  RUNNING,
  COMPLETED,
  FAILED,
  CANCELED,
  UNKNOWN,
  RECONCILING,
  STALLED;

  public boolean isActive() {
    return switch (this) {
      case QUEUED, SUBMITTING, SUBMITTED, RUNNING, UNKNOWN, RECONCILING, STALLED -> true;
      case COMPLETED, FAILED, CANCELED -> false;
    };
  }

  public boolean isTerminal() {
    return switch (this) {
      case COMPLETED, FAILED, CANCELED -> true;
      case QUEUED, SUBMITTING, SUBMITTED, RUNNING, UNKNOWN, RECONCILING, STALLED -> false;
    };
  }
}
