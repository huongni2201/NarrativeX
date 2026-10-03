package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationExecutionStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationReviewStatus;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One immutable execution attempt for one planned VisualBeat. */
public final class MediaGenerationItem {
  private final UUID id;
  private final long rowVersion;
  private final UUID generationJobId;
  private final UUID mediaPlanId;
  private final UUID visualBeatId;
  private final UUID shotId;
  private final int orderIndex;
  private final UUID leafGenerationJobId;
  private final UUID takeId;
  private final String frozenInputJson;
  private final String frozenInputFingerprint;
  private final String itemKey;
  private final int attemptNumber;
  private MediaGenerationExecutionStatus executionStatus;
  private final UUID providerOperationId;
  private final UUID mediaAssetId;
  private final String requestFingerprint;
  private final String errorCode;
  private final String errorDetailRef;
  private MediaGenerationReviewStatus reviewStatus;
  private Instant reviewedAt;

  private MediaGenerationItem(
      UUID id,
      long rowVersion,
      UUID generationJobId,
      UUID mediaPlanId,
      UUID visualBeatId,
      String itemKey,
      int attemptNumber,
      MediaGenerationExecutionStatus executionStatus,
      UUID providerOperationId,
      UUID mediaAssetId,
      String requestFingerprint,
      String errorCode,
      String errorDetailRef,
      MediaGenerationReviewStatus reviewStatus,
      Instant reviewedAt, UUID shotId, int orderIndex, UUID leafGenerationJobId, UUID takeId,
      String frozenInputJson, String frozenInputFingerprint) {
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
    this.reviewedAt = reviewedAt;
    this.shotId = shotId;
    this.orderIndex = orderIndex;
    this.leafGenerationJobId = leafGenerationJobId;
    this.takeId = takeId;
    this.frozenInputJson = frozenInputJson;
    this.frozenInputFingerprint = frozenInputFingerprint;
  }

  public static MediaGenerationItem create(
      UUID generationJobId,
      UUID mediaPlanId,
      UUID visualBeatId,
      String itemKey,
      int attemptNumber,
      String requestFingerprint) {
    return new MediaGenerationItem(
        UuidV7.random(),
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
        null, null, 0, null, null, null, null);
  }

  public static MediaGenerationItem rehydrate(
      UUID id,
      long rowVersion,
      UUID generationJobId,
      UUID mediaPlanId,
      UUID visualBeatId,
      String itemKey,
      int attemptNumber,
      MediaGenerationExecutionStatus executionStatus,
      UUID providerOperationId,
      UUID mediaAssetId,
      String requestFingerprint,
      String errorCode,
      String errorDetailRef,
      MediaGenerationReviewStatus reviewStatus,
      Instant reviewedAt, UUID shotId, int orderIndex, UUID leafGenerationJobId, UUID takeId,
      String frozenInputJson, String frozenInputFingerprint) {
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
        reviewedAt, shotId, orderIndex, leafGenerationJobId, takeId, frozenInputJson, frozenInputFingerprint);
  }

  public static MediaGenerationItem createShot(UUID jobId, UUID planId, UUID beatId, UUID shotId,
      int orderIndex, String requestFingerprint, String frozenInputJson, String frozenInputFingerprint) {
    return new MediaGenerationItem(UuidV7.random(), 0L, jobId, planId, beatId, "shot-" + shotId,
        1, MediaGenerationExecutionStatus.QUEUED, null, null, requestFingerprint, null, null,
        MediaGenerationReviewStatus.NOT_READY, null, shotId, orderIndex, null, null,
        frozenInputJson, frozenInputFingerprint);
  }

  public static MediaGenerationItem rehydrate(UUID id, long rowVersion, UUID generationJobId,
      UUID mediaPlanId, UUID visualBeatId, String itemKey, int attemptNumber,
      MediaGenerationExecutionStatus executionStatus, UUID providerOperationId, UUID mediaAssetId,
      String requestFingerprint, String errorCode, String errorDetailRef,
      MediaGenerationReviewStatus reviewStatus, Instant reviewedAt) {
    return rehydrate(id, rowVersion, generationJobId, mediaPlanId, visualBeatId, itemKey, attemptNumber,
        executionStatus, providerOperationId, mediaAssetId, requestFingerprint, errorCode,
        errorDetailRef, reviewStatus, reviewedAt, null, 0, null, null, null, null);
  }

  public UUID getShotId() { return shotId; }
  public int getOrderIndex() { return orderIndex; }
  public UUID getLeafGenerationJobId() { return leafGenerationJobId; }
  public UUID getTakeId() { return takeId; }
  public String getFrozenInputJson() { return frozenInputJson; }
  public String getFrozenInputFingerprint() { return frozenInputFingerprint; }

  public UUID getGenerationJobId() {
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

  public UUID getVisualBeatId() {
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

  public UUID getProviderOperationId() {
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

  public Instant getReviewedAt() {
    return reviewedAt;
  }

  public void review(MediaGenerationReviewStatus decision, Instant at) {
    if (executionStatus != MediaGenerationExecutionStatus.READY
        || reviewStatus != MediaGenerationReviewStatus.NEEDS_REVIEW) {
      throw new IllegalStateException("Only READY items awaiting review can be reviewed");
    }
    reviewStatus = Objects.requireNonNull(decision, "decision");
    reviewedAt = Objects.requireNonNull(at, "at");
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
