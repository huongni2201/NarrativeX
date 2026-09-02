package com.narrativex.backend.feature.generation.api.request;

import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record UpdateProductionBeatMediaRequest(
    @NotNull UUID mediaAssetId, BeatMediaFitMode fitMode, @Min(0) Long trimStartMs) {
  public long normalizedTrimStartMs() {
    return trimStartMs == null ? 0L : trimStartMs;
  }
}
