package com.narrativex.backend.feature.generation.domain.entity;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

public record NarrationRequest(
    UUID id,
    Long projectId,
    Long chapterId,
    long chapterRowVersion,
    String sourceHash,
    String sourceText,
    String voiceId,
    String language,
    BigDecimal speakingRate,
    String segmentationVersion,
    String requestFingerprint) {
  public NarrationRequest {
    Objects.requireNonNull(id, "id");
    if (projectId == null || projectId <= 0)
      throw new IllegalArgumentException("projectId must be positive");
    if (chapterId == null || chapterId <= 0)
      throw new IllegalArgumentException("chapterId must be positive");
    if (chapterRowVersion < 0)
      throw new IllegalArgumentException("chapterRowVersion must not be negative");
    requireText(sourceHash, "sourceHash");
    requireText(sourceText, "sourceText");
    requireText(voiceId, "voiceId");
    requireText(language, "language");
    Objects.requireNonNull(speakingRate, "speakingRate");
    if (speakingRate.signum() <= 0)
      throw new IllegalArgumentException("speakingRate must be positive");
    requireText(segmentationVersion, "segmentationVersion");
    requireText(requestFingerprint, "requestFingerprint");
  }

  private static void requireText(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
  }
}
