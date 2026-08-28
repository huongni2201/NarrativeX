package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

public record GenerateChapterNarrationCommand(
    UUID projectId,
    UUID chapterId,
    String voiceId,
    BigDecimal speakingRate,
    UUID voiceReferenceAssetId,
    boolean forceRegenerate,
    String previewText) {
  public GenerateChapterNarrationCommand(
      UUID projectId,
      UUID chapterId,
      String voiceId,
      BigDecimal speakingRate,
      UUID voiceReferenceAssetId) {
    this(projectId, chapterId, voiceId, speakingRate, voiceReferenceAssetId, false, null);
  }

  public GenerateChapterNarrationCommand(
      UUID projectId,
      UUID chapterId,
      String voiceId,
      BigDecimal speakingRate,
      UUID voiceReferenceAssetId,
      boolean forceRegenerate) {
    this(projectId, chapterId, voiceId, speakingRate, voiceReferenceAssetId, forceRegenerate, null);
  }

  public GenerateChapterNarrationCommand(
      UUID projectId,
      UUID chapterId,
      String voiceId,
      BigDecimal speakingRate,
      UUID voiceReferenceAssetId,
      String previewText) {
    this(projectId, chapterId, voiceId, speakingRate, voiceReferenceAssetId, false, previewText);
  }

  public GenerateChapterNarrationCommand {
    Objects.requireNonNull(projectId, "projectId");
    Objects.requireNonNull(chapterId, "chapterId");
    if (voiceId == null || voiceId.isBlank()) {
      throw new IllegalArgumentException("voiceId must not be blank");
    }
    if (speakingRate == null || speakingRate.signum() <= 0) {
      throw new IllegalArgumentException("speakingRate must be positive");
    }
    if (previewText != null) {
      previewText = previewText.trim();
      if (previewText.isEmpty()) {
        throw new IllegalArgumentException("previewText must not be blank");
      }
      if (previewText.length() > 500) {
        throw new IllegalArgumentException("previewText must not exceed 500 characters");
      }
      if (voiceReferenceAssetId == null) {
        throw new IllegalArgumentException("Voice preview requires a voice reference asset");
      }
    }
  }

  public boolean preview() {
    return previewText != null;
  }
}
