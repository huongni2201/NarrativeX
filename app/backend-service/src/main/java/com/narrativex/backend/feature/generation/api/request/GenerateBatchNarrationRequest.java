package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record GenerateBatchNarrationRequest(
    @NotEmpty @Size(max = 50) List<@NotNull UUID> chapterIds,
    @NotBlank String voiceId,
    @DecimalMin("0.25") @DecimalMax("2.0") BigDecimal speakingRate,
    UUID voiceReferenceAssetId) {
  public BigDecimal effectiveSpeakingRate() {
    return speakingRate == null ? BigDecimal.ONE : speakingRate;
  }
}
