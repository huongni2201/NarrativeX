package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record GenerateChapterNarrationRequest(
    @NotBlank String voiceId, @DecimalMin("0.25") @DecimalMax("2.0") BigDecimal speakingRate) {
  public BigDecimal effectiveSpeakingRate() {
    return speakingRate == null ? BigDecimal.ONE : speakingRate;
  }
}
