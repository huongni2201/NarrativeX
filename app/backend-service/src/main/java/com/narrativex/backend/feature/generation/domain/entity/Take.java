package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.util.Objects;
import java.util.UUID;
import lombok.Getter;

/** Individual generation attempt for a Shot. */
public final class Take extends DomainEntity {
  @Getter private final UUID shotId;
  @Getter private final int attemptNumber;
  @Getter private final String provider;
  @Getter private final String model;
  @Getter private final GenerationStrategy generationMode;
  @Getter private final UUID outputAssetId;
  @Getter private final Long sourceDurationMs;
  @Getter private final String metricsJson;
  @Getter private final String validationStatus;
  @Getter private final VideoQAFailureCategory validationFailureCategory;
  @Getter private final String validationFailureReason;
  @Getter private final String validationRetryRecommendation;
  @Getter private final String status;

  public Take(
      UUID shotId,
      int attemptNumber,
      String provider,
      String model,
      GenerationStrategy generationMode,
      UUID outputAssetId,
      Long sourceDurationMs,
      String metricsJson,
      String validationStatus,
      VideoQAFailureCategory validationFailureCategory,
      String validationFailureReason,
      String validationRetryRecommendation,
      String status) {
    this(
        null,
        0L,
        shotId,
        attemptNumber,
        provider,
        model,
        generationMode,
        outputAssetId,
        sourceDurationMs,
        metricsJson,
        validationStatus,
        validationFailureCategory,
        validationFailureReason,
        validationRetryRecommendation,
        status);
  }

  public Take(
      UUID id,
      long rowVersion,
      UUID shotId,
      int attemptNumber,
      String provider,
      String model,
      GenerationStrategy generationMode,
      UUID outputAssetId,
      Long sourceDurationMs,
      String metricsJson,
      String validationStatus,
      VideoQAFailureCategory validationFailureCategory,
      String validationFailureReason,
      String validationRetryRecommendation,
      String status) {
    super(id, rowVersion);
    this.shotId = Objects.requireNonNull(shotId, "shotId must not be null");
    this.attemptNumber = attemptNumber;
    this.provider = provider != null ? provider.trim() : "ltx";
    this.model = model != null ? model.trim() : "ltx-2.5-nvfp4";
    this.generationMode =
        generationMode != null ? generationMode : GenerationStrategy.TEXT_TO_VIDEO;
    this.outputAssetId = outputAssetId;
    this.sourceDurationMs = sourceDurationMs;
    this.metricsJson = metricsJson != null ? metricsJson.trim() : "{}";
    this.validationStatus = validationStatus != null ? validationStatus.trim() : "PENDING";
    this.validationFailureCategory = validationFailureCategory;
    this.validationFailureReason = validationFailureReason;
    this.validationRetryRecommendation = validationRetryRecommendation;
    this.status = status != null ? status.trim() : "PENDING";
  }
}
