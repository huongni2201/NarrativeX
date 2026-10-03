package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import java.util.Objects;
import java.util.UUID;

/** Durable operation metadata persisted before expensive work is submitted. */
public final class OperationPlan extends AggregateRoot {
  private final UUID projectId;
  private final UUID generationJobId;
  private final String operationType;
  private final UUID scopeId;
  private final String inputFingerprint;

  private OperationPlan(
      UUID id,
      long rowVersion,
      UUID projectId,
      UUID generationJobId,
      String operationType,
      UUID scopeId,
      String inputFingerprint) {
    super(id, rowVersion);
    this.projectId = Objects.requireNonNull(projectId, "projectId");
    this.generationJobId = generationJobId;
    if (operationType == null || operationType.isBlank()) {
      throw new IllegalArgumentException("operationType must not be blank");
    }
    this.operationType = operationType;
    this.scopeId = scopeId;
    this.inputFingerprint = inputFingerprint;
  }

  public static OperationPlan create(UUID projectId, String operationType) {
    return new OperationPlan(null, 0L, projectId, null, operationType, null, null);
  }

  public static OperationPlan rehydrate(
      UUID id, long rowVersion, UUID projectId, UUID generationJobId, String operationType) {
    return new OperationPlan(id, rowVersion, projectId, generationJobId, operationType, null, null);
  }

  public OperationPlan withGenerationJobId(UUID jobId) {
    return new OperationPlan(
        getId(),
        getRowVersion(),
        projectId,
        Objects.requireNonNull(jobId, "jobId"),
        operationType,
        scopeId,
        inputFingerprint);
  }

  public static OperationPlan forShot(UUID projectId, UUID shotId, String fingerprint) {
    return new OperationPlan(null, 0L, projectId, null, "SHOT_VIDEO_GENERATE", shotId, fingerprint);
  }

  public static OperationPlan rehydrate(
      UUID id,
      long rowVersion,
      UUID projectId,
      UUID jobId,
      String type,
      UUID scopeId,
      String fingerprint) {
    return new OperationPlan(id, rowVersion, projectId, jobId, type, scopeId, fingerprint);
  }

  public UUID getScopeId() {
    return scopeId;
  }

  public String getInputFingerprint() {
    return inputFingerprint;
  }

  public UUID getProjectId() {
    return projectId;
  }

  public UUID getGenerationJobId() {
    return generationJobId;
  }

  public String getOperationType() {
    return operationType;
  }
}
