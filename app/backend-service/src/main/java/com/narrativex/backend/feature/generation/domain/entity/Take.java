package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.util.Objects;
import java.util.UUID;

/** Individual generation attempt for a Shot. */
public final class Take extends DomainEntity {
  private final UUID shotId;
  private final int attemptNumber;
  private final String provider;
  private final String model;
  private final GenerationStrategy generationMode;
  private final UUID outputAssetId;
  private final Long sourceDurationMs;
  private final String metricsJson;
  private final String validationStatus;
  private final VideoQAFailureCategory validationFailureCategory;
  private final String validationFailureReason;
  private final String validationRetryRecommendation;
  private final String status;

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

  public UUID getShotId() {
    return shotId;
  }

  public int getAttemptNumber() {
    return attemptNumber;
  }

  public String getProvider() {
    return provider;
  }

  public String getModel() {
    return model;
  }

  public GenerationStrategy getGenerationMode() {
    return generationMode;
  }

  public UUID getOutputAssetId() {
    return outputAssetId;
  }

  public Long getSourceDurationMs() {
    return sourceDurationMs;
  }

  public String getMetricsJson() {
    return metricsJson;
  }

  public String getValidationStatus() {
    return validationStatus;
  }

  public VideoQAFailureCategory getValidationFailureCategory() {
    return validationFailureCategory;
  }

  public String getValidationFailureReason() {
    return validationFailureReason;
  }

  public String getValidationRetryRecommendation() {
    return validationRetryRecommendation;
  }

  public String getStatus() {
    return status;
  }
}
