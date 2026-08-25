package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

public final class ProviderOperation extends DomainEntity {
  private static final Pattern SHA256_PATTERN = Pattern.compile("^[0-9a-f]{64}$");

  private final UUID stageAttemptId;
  private final String providerKey;
  private final String providerOperationId;
  private final ProviderOperationStatus status;
  private final Instant reservedAt;
  private final String requestFingerprint;
  private final String normalizedResultJson;
  private final String resultFingerprint;
  private final Instant completedAt;
  private final Instant nextReconcileAt;
  private final int reconcileAttempts;
  private final String lastReconcileError;

  private ProviderOperation(
      UUID id,
      long rowVersion,
      UUID stageAttemptId,
      String providerKey,
      String providerOperationId,
      ProviderOperationStatus status,
      Instant reservedAt,
      String requestFingerprint,
      String normalizedResultJson,
      String resultFingerprint,
      Instant completedAt,
      Instant nextReconcileAt,
      int reconcileAttempts,
      String lastReconcileError) {
    super(id, rowVersion);
    this.stageAttemptId = Objects.requireNonNull(stageAttemptId, "stageAttemptId");
    if (providerKey == null || providerKey.isBlank())
      throw new IllegalArgumentException("providerKey must not be blank");
    this.providerKey = providerKey;
    this.providerOperationId = providerOperationId;
    this.status = Objects.requireNonNull(status, "status");
    this.reservedAt = Objects.requireNonNull(reservedAt, "reservedAt");
    this.requestFingerprint = requireSha256(requestFingerprint, "requestFingerprint");
    this.normalizedResultJson = normalizedResultJson;
    this.resultFingerprint = resultFingerprint;
    this.completedAt = completedAt;
    this.nextReconcileAt = nextReconcileAt;
    if (reconcileAttempts < 0)
      throw new IllegalArgumentException("reconcileAttempts must be nonnegative");
    this.reconcileAttempts = reconcileAttempts;
    this.lastReconcileError = lastReconcileError;
  }

  public static ProviderOperation create(
      UUID stageAttemptId, String providerKey, String requestFingerprint) {
    return new ProviderOperation(
        null,
        0L,
        stageAttemptId,
        providerKey,
        null,
        ProviderOperationStatus.RESERVED,
        Instant.now(),
        requestFingerprint,
        null,
        null,
        null,
        null,
        0,
        null);
  }

  public static ProviderOperation rehydrate(
      UUID id,
      long rowVersion,
      UUID stageAttemptId,
      String providerKey,
      String providerOperationId,
      ProviderOperationStatus status,
      Instant reservedAt,
      String requestFingerprint) {
    return rehydrate(
        id,
        rowVersion,
        stageAttemptId,
        providerKey,
        providerOperationId,
        status,
        reservedAt,
        requestFingerprint,
        null,
        null,
        null,
        null,
        0,
        null);
  }

  public static ProviderOperation rehydrate(
      UUID id,
      long rowVersion,
      UUID stageAttemptId,
      String providerKey,
      String providerOperationId,
      ProviderOperationStatus status,
      Instant reservedAt,
      String requestFingerprint,
      String normalizedResultJson,
      String resultFingerprint,
      Instant completedAt,
      Instant nextReconcileAt,
      int reconcileAttempts,
      String lastReconcileError) {
    return new ProviderOperation(
        id,
        rowVersion,
        stageAttemptId,
        providerKey,
        providerOperationId,
        status,
        reservedAt,
        requestFingerprint,
        normalizedResultJson,
        resultFingerprint,
        completedAt,
        nextReconcileAt,
        reconcileAttempts,
        lastReconcileError);
  }

  public UUID getStageAttemptId() {
    return stageAttemptId;
  }

  public String getProviderKey() {
    return providerKey;
  }

  public String getProviderOperationId() {
    return providerOperationId;
  }

  public ProviderOperationStatus getStatus() {
    return status;
  }

  public Instant getReservedAt() {
    return reservedAt;
  }

  public String getRequestFingerprint() {
    return requestFingerprint;
  }

  public String getNormalizedResultJson() {
    return normalizedResultJson;
  }

  public String getResultFingerprint() {
    return resultFingerprint;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public Instant getNextReconcileAt() {
    return nextReconcileAt;
  }

  public int getReconcileAttempts() {
    return reconcileAttempts;
  }

  public String getLastReconcileError() {
    return lastReconcileError;
  }

  public boolean canTransitionTo(ProviderOperationStatus nextStatus) {
    return allowedPreviousStatuses(nextStatus).contains(status);
  }

  public static Set<ProviderOperationStatus> allowedPreviousStatuses(
      ProviderOperationStatus nextStatus) {
    return switch (Objects.requireNonNull(nextStatus, "nextStatus")) {
      case UNKNOWN ->
          EnumSet.of(
              ProviderOperationStatus.RESERVED,
              ProviderOperationStatus.SUBMITTED,
              ProviderOperationStatus.RUNNING);
      case SUBMITTED -> EnumSet.of(ProviderOperationStatus.UNKNOWN);
      case RUNNING ->
          EnumSet.of(ProviderOperationStatus.UNKNOWN, ProviderOperationStatus.SUBMITTED);
      case COMPLETED ->
          EnumSet.of(
              ProviderOperationStatus.UNKNOWN,
              ProviderOperationStatus.SUBMITTED,
              ProviderOperationStatus.RUNNING);
      case FAILED ->
          EnumSet.of(
              ProviderOperationStatus.UNKNOWN,
              ProviderOperationStatus.SUBMITTED,
              ProviderOperationStatus.RUNNING);
      case RESERVED -> EnumSet.noneOf(ProviderOperationStatus.class);
    };
  }

  private static String requireSha256(String value, String fieldName) {
    if (value == null || !SHA256_PATTERN.matcher(value).matches()) {
      throw new IllegalArgumentException(
          fieldName + " must be a lowercase 64-character SHA-256 hex digest");
    }
    return value;
  }
}
