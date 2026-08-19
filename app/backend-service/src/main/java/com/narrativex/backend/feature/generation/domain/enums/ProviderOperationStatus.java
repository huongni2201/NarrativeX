package com.narrativex.backend.feature.generation.domain.enums;

public enum ProviderOperationStatus {
  RESERVED,
  SUBMITTED,
  RUNNING,
  COMPLETED,
  FAILED,
  UNKNOWN;

  public boolean isTerminal() {
    return this == COMPLETED || this == FAILED;
  }
}
