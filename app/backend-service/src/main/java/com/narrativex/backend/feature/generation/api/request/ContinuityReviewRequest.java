package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record ContinuityReviewRequest(
    @NotNull UUID planId,
    int reportRevision,
    @NotEmpty List<String> issueIds,
    @NotNull Decision decision) {
  public enum Decision {
    ACKNOWLEDGE_WARNING
  }
}
