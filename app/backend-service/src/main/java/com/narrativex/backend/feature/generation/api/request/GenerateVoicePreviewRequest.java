package com.narrativex.backend.feature.generation.api.request;

import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record GenerateVoicePreviewRequest(
    @NotNull UUID chapterId,
    @NotBlank String voiceId,
    @NotBlank @Size(max = 500) String sampleText,
    @DecimalMin("0.25") @DecimalMax("2.0") BigDecimal speakingRate,
    @NotNull @Valid VoiceReferenceSelection voiceReference) {
  public BigDecimal effectiveSpeakingRate() {
    return speakingRate == null ? BigDecimal.ONE : speakingRate;
  }
}
