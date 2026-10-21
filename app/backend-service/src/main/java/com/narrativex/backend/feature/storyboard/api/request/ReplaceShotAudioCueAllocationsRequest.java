package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record ReplaceShotAudioCueAllocationsRequest(
    @NotNull @Min(0) Long expectedRowVersion, @NotNull List<@Valid Assignment> allocations) {
  public record Assignment(@NotNull UUID audioCueId, @NotNull UUID shotId) {}
}
