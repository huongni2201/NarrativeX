package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationExecutionStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationReviewStatus;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One immutable execution attempt for one planned VisualBeat. */
public final class MediaGenerationItem {
  private final UUID id;
  private final long rowVersion;
  private final Long generationJobId;
  private final UUID mediaPlanId;
  private final Long visualBeatId;
  private final String itemKey;
  private final int attemptNumber;
  private MediaGenerationExecutionStatus executionStatus;
  private final Long providerOperationId;
  private final UUID mediaAssetId;
  private final String requestFingerprint;
  private final String errorCode;
  private final String errorDetailRef;
  private MediaGenerationReviewStatus reviewStatus;
  private String reviewedByUserId;
  private Instant reviewedAt;

  private MediaGenerationItem(
      UUID id,
      long rowVersion,
      Long generationJobId,
      UUID mediaPlanId,
      Long visualBeatId,
      String itemKey,
      int attemptNumber,
      MediaGenerationExecutionStatus executionStatus,
      Long providerOperationId,
      UUID mediaAssetId,
      String requestFingerprint,
      String errorCode,
      String errorDetailRef,
      MediaGenerationReviewStatus reviewStatus,
      String reviewedByUserId,
      Instant reviewedAt) {
    this.id = Objects.requireNonNull(id, "id");
    this.rowVersion = rowVersion;
    this.generationJobId = Objects.requireNonNull(generationJobId, "generationJobId");
    this.mediaPlanId = Objects.requireNonNull(mediaPlanId, "mediaPlanId");
    this.visualBeatId = Objects.requireNonNull(visualBeatId, "visualBeatId");
    this.itemKey = required(itemKey, "itemKey");
    if (attemptNumber <= 0) throw new IllegalArgumentException("attemptNumber must be positive");
    this.attemptNumber = attemptNumber;
    this.executionStatus = Objects.requireNonNull(executionStatus, "executionStatus");
    this.providerOperationId = providerOperationId;
    this.mediaAssetId = mediaAssetId;
    this.requestFingerprint = required(requestFingerprint, "requestFingerprint");
    this.errorCode = errorCode;
    this.errorDetailRef = errorDetailRef;
    this.reviewStatus = Objects.requireNonNull(reviewStatus, "reviewStatus");
    this.reviewedByUserId = reviewedByUserId;
    this.reviewedAt = reviewedAt;
  }

  public static MediaGenerationItem create(
      Long generationJobId,
      UUID mediaPlanId,
      Long visualBeatId,
      String itemKey,
      int attemptNumber,
      String requestFingerprint) {
    return new MediaGenerationItem(
        UUID.randomUUID(),
        0L,
        generationJobId,
        mediaPlanId,
        visualBeatId,
        itemKey,
        attemptNumber,
        MediaGenerationExecutionStatus.QUEUED,
        null,
        null,
        requestFingerprint,
        null,
        null,
        MediaGenerationReviewStatus.NOT_READY,
        null,
        null);
  }

  public static MediaGenerationItem rehydrate(
      UUID id,
      long rowVersion,
      Long generationJobId,
      UUID mediaPlanId,
      Long visualBeatId,
      String itemKey,
      int attemptNumber,
      MediaGenerationExecutionStatus executionStatus,
      Long providerOperationId,
      UUID mediaAssetId,
      String requestFingerprint,
      String errorCode,
      String errorDetailRef,
      MediaGenerationReviewStatus reviewStatus,
      String reviewedByUserId,
      Instant reviewedAt) {
    return new MediaGenerationItem(
        id,
        rowVersion,
        generationJobId,
        mediaPlanId,
        visualBeatId,
        itemKey,
        attemptNumber,
        executionStatus,
        providerOperationId,
        mediaAssetId,
        requestFingerprint,
        errorCode,
        errorDetailRef,
        reviewStatus,
        reviewedByUserId,
        reviewedAt);
  }

  public Long getGenerationJobId() {
    return generationJobId;
  }

  public UUID getId() {
    return id;
  }

  public long getRowVersion() {
    return rowVersion;
  }

  public UUID getMediaPlanId() {
    return mediaPlanId;
  }

  public Long getVisualBeatId() {
    return visualBeatId;
  }

  public String getItemKey() {
    return itemKey;
  }

  public int getAttemptNumber() {
    return attemptNumber;
  }

  public MediaGenerationExecutionStatus getExecutionStatus() {
    return executionStatus;
  }

  public Long getProviderOperationId() {
    return providerOperationId;
  }

  public UUID getMediaAssetId() {
    return mediaAssetId;
  }

  public String getRequestFingerprint() {
    return requestFingerprint;
  }

  public String getErrorCode() {
    return errorCode;
  }

  public String getErrorDetailRef() {
    return errorDetailRef;
  }

  public MediaGenerationReviewStatus getReviewStatus() {
    return reviewStatus;
  }

  public String getReviewedByUserId() {
    return reviewedByUserId;
  }

  public Instant getReviewedAt() {
    return reviewedAt;
  }

  public void review(MediaGenerationReviewStatus decision, String reviewerId, Instant at) {
    if (executionStatus != MediaGenerationExecutionStatus.READY
        || reviewStatus != MediaGenerationReviewStatus.NEEDS_REVIEW) {
      throw new IllegalStateException("Only READY items awaiting review can be reviewed");
    }
    reviewStatus = Objects.requireNonNull(decision, "decision");
    reviewedByUserId = required(reviewerId, "reviewerId");
    reviewedAt = Objects.requireNonNull(at, "at");
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
