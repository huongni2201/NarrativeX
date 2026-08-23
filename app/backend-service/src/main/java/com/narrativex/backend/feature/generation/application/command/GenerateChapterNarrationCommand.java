package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

public record GenerateChapterNarrationCommand(
    UUID projectId,
    UUID chapterId,
    String voiceId,
    BigDecimal speakingRate,
    UUID voiceReferenceAssetId) {
  public GenerateChapterNarrationCommand {
    Objects.requireNonNull(projectId, "projectId");
    Objects.requireNonNull(chapterId, "chapterId");
    if (voiceId == null || voiceId.isBlank())
      throw new IllegalArgumentException("voiceId must not be blank");
    if (speakingRate == null || speakingRate.signum() <= 0) {
      throw new IllegalArgumentException("speakingRate must be positive");
    }
  }
}
