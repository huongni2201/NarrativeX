package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import java.time.Instant;
import java.util.Objects;

public final class ProviderOperation extends DomainEntity {
  private final Long stageAttemptId;
  private final String providerKey;
  private final String providerOperationId;
  private final ProviderOperationStatus status;
  private final Instant reservedAt;
  private final String requestFingerprint;

  private ProviderOperation(
      Long id,
      long rowVersion,
      Long stageAttemptId,
      String providerKey,
      String providerOperationId,
      ProviderOperationStatus status,
      Instant reservedAt,
      String requestFingerprint) {
    super(id, rowVersion);
    if (stageAttemptId == null || stageAttemptId <= 0)
      throw new IllegalArgumentException("stageAttemptId must be positive");
    this.stageAttemptId = stageAttemptId;
    if (providerKey == null || providerKey.isBlank())
      throw new IllegalArgumentException("providerKey must not be blank");
    this.providerKey = providerKey;
    this.providerOperationId = providerOperationId;
    this.status = Objects.requireNonNull(status, "status");
    this.reservedAt = Objects.requireNonNull(reservedAt, "reservedAt");
    this.requestFingerprint = requestFingerprint;
  }

  public static ProviderOperation create(Long stageAttemptId, String providerKey) {
    return create(stageAttemptId, providerKey, null);
  }

  public static ProviderOperation create(
      Long stageAttemptId, String providerKey, String requestFingerprint) {
    return new ProviderOperation(
        null,
        0L,
        stageAttemptId,
        providerKey,
        null,
        ProviderOperationStatus.RESERVED,
        Instant.now(),
        requestFingerprint);
  }

  public static ProviderOperation rehydrate(
      Long id,
      long rowVersion,
      Long stageAttemptId,
      String providerKey,
      String providerOperationId,
      ProviderOperationStatus status,
      Instant reservedAt) {
    return new ProviderOperation(
        id, rowVersion, stageAttemptId, providerKey, providerOperationId, status, reservedAt, null);
  }

  public static ProviderOperation rehydrate(
      Long id,
      long rowVersion,
      Long stageAttemptId,
      String providerKey,
      String providerOperationId,
      ProviderOperationStatus status,
      Instant reservedAt,
      String requestFingerprint) {
    return new ProviderOperation(
        id,
        rowVersion,
        stageAttemptId,
        providerKey,
        providerOperationId,
        status,
        reservedAt,
        requestFingerprint);
  }

  public Long getStageAttemptId() {
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
}
