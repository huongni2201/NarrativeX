package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.UUID;

public record GenerateChapterNarrationCommand(
    Long projectId,
    Long chapterId,
    String voiceId,
    BigDecimal speakingRate,
    UUID voiceReferenceAssetId) {
  public GenerateChapterNarrationCommand {
    if (projectId == null || projectId <= 0)
      throw new IllegalArgumentException("projectId must be positive");
    if (chapterId == null || chapterId <= 0)
      throw new IllegalArgumentException("chapterId must be positive");
    if (voiceId == null || voiceId.isBlank())
      throw new IllegalArgumentException("voiceId must not be blank");
    if (speakingRate == null || speakingRate.signum() <= 0) {
      throw new IllegalArgumentException("speakingRate must be positive");
    }
  }
}
