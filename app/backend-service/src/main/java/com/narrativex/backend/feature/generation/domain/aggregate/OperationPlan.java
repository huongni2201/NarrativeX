package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import java.util.Objects;
import java.util.UUID;

/** Durable operation metadata persisted before expensive work is submitted. */
public final class OperationPlan extends AggregateRoot {
  private final UUID projectId;
  private final UUID generationJobId;
  private final String operationType;

  private OperationPlan(
      UUID id,
      long rowVersion,
      UUID projectId,
      UUID generationJobId,
      String operationType) {
    super(id, rowVersion);
    this.projectId = Objects.requireNonNull(projectId, "projectId");
    this.generationJobId = generationJobId;
    if (operationType == null || operationType.isBlank()) {
      throw new IllegalArgumentException("operationType must not be blank");
    }
    this.operationType = operationType;
  }

  public static OperationPlan create(UUID projectId, String operationType) {
    return new OperationPlan(null, 0L, projectId, null, operationType);
  }

  public static OperationPlan rehydrate(
      UUID id,
      long rowVersion,
      UUID projectId,
      UUID generationJobId,
      String operationType) {
    return new OperationPlan(id, rowVersion, projectId, generationJobId, operationType);
  }

  public OperationPlan withGenerationJobId(UUID jobId) {
    return new OperationPlan(
        getId(),
        getRowVersion(),
        projectId,
        Objects.requireNonNull(jobId, "jobId"),
        operationType);
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
