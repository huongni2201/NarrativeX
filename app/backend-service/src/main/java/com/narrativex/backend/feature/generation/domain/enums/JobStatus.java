package com.narrativex.backend.feature.generation.domain.enums;

public enum JobStatus {
  QUEUED,
  RUNNING,
  COMPLETED,
  FAILED,
  CANCELED,
  UNKNOWN,
  STALLED;

  public boolean isActive() {
    return switch (this) {
      case QUEUED, RUNNING, UNKNOWN, STALLED -> true;
      case COMPLETED, FAILED, CANCELED -> false;
    };
  }

  public boolean isTerminal() {
    return switch (this) {
      case COMPLETED, FAILED, CANCELED -> true;
      case QUEUED, RUNNING, UNKNOWN, STALLED -> false;
    };
  }
}
