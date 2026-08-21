package com.narrativex.backend.feature.generation.domain.entity;

import java.util.Objects;
import java.util.UUID;

/** Domain grouping only; provider lifecycle remains in ProviderOperation. */
public record NarrationOperation(
    UUID id, UUID narrationRequestId, Long generationJobId, Long stageAttemptId) {
  public NarrationOperation {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(narrationRequestId, "narrationRequestId");
    if (generationJobId == null || generationJobId <= 0) {
      throw new IllegalArgumentException("generationJobId must be positive");
    }
    if (stageAttemptId == null || stageAttemptId <= 0) {
      throw new IllegalArgumentException("stageAttemptId must be positive");
    }
  }
}
