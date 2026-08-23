package com.narrativex.backend.feature.generation.domain.entity;

import java.util.Objects;
import java.util.UUID;

/** Domain grouping only; provider lifecycle remains in ProviderOperation. */
public record NarrationOperation(
    UUID id, UUID narrationRequestId, UUID generationJobId, UUID stageAttemptId) {
  public NarrationOperation {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(narrationRequestId, "narrationRequestId");
    Objects.requireNonNull(generationJobId, "generationJobId");
    Objects.requireNonNull(stageAttemptId, "stageAttemptId");
  }
}
